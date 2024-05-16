import { Prisma } from "@prisma/client";
import { erp } from "../dataSources/erp/index.js";
import prisma from "../db/index.js";
import { writeStdOut } from "../utils/writeStdOut.js";
import { GetOneProductResponse } from "../dataSources/erp/types.js";
import { sendEmail } from "../mail/index.js";
import { readFile } from "fs/promises";

export const updateProductInterdataCodes = async () => {
  const tnProducts = await prisma.tNProduct.findMany({
    where: {
      interdataCode: null,
    },
  });

  console.log(`Updating ${tnProducts.length} products...`);

  const batchedTnProducts = tnProducts.reduce<(typeof tnProducts)[]>(
    (acc, product) => {
      if (acc[acc.length - 1].length < 30) {
        acc[acc.length - 1].push(product);
      } else {
        acc.push([product]);
      }
      return acc;
    },
    [[]]
  );

  const erpProducts: GetOneProductResponse[] = [];
  let i = 0;
  for (const batch of batchedTnProducts) {
    writeStdOut(`Fetching batch ${i++} of ${batchedTnProducts.length}`);
    const batchedErpProducts = await Promise.all(
      batch.map((product) =>
        erp.getOneProduct(product.code).catch(() => {
          void sendEmail(`Error fetching product ${product.code} from ERP`);
          return undefined;
        })
      )
    );

    batchedErpProducts.forEach((erpProduct) => {
      if (erpProduct) erpProducts.push(erpProduct);
    });
  }
  writeStdOut("Finished fetching products", true);

  const tnProductsToUpdate: Prisma.TNProductUpdateArgs[] = [];

  for (const product of erpProducts) {
    tnProductsToUpdate.push({
      where: {
        code: product.prd_alterna,
      },
      data: {
        interdataCode: product.prd_codigo,
      },
    });
  }

  for (let i = 0; i < tnProductsToUpdate.length + 100; i += 100) {
    writeStdOut(
      `Updating product codes map... ${i}/${tnProductsToUpdate.length}`
    );
    const chunk = tnProductsToUpdate.slice(i, i + 100);
    await Promise.all(chunk.map((args) => prisma.tNProduct.update(args)));
  }

  console.log("Product codes map updated!");
  console.log(`Updated ${erpProducts.length} products`);
};
