import { writeFile } from "fs/promises";
import { erp } from "../dataSources/erp/index.js";
import prisma from "../db/index.js";
import { GetOneProductResponse } from "../dataSources/erp/types.js";
import { writeStdOut } from "../utils/writeStdOut.js";

export const findErpDisabledProducts = async () => {
  const tnProducts = await prisma.tNProduct.findMany();

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
  const missingErpProducts: {
    code: string;
    id: number;
  }[] = [];
  let i = 0;
  for (const batch of batchedTnProducts) {
    writeStdOut(`Fetching batch ${i++} of ${batchedTnProducts.length}`);
    const batchedErpProducts = await Promise.all(
      batch.map((product) =>
        erp
          .getOneProduct(product.code)
          .then((erpProduct) => {
            if (!erpProduct) {
              missingErpProducts.push({
                code: product.code,
                id: product.productId,
              });
            }
            return erpProduct;
          })
          .catch(() => {
            missingErpProducts.push({
              code: product.code,
              id: product.productId,
            });
            return undefined;
          })
      )
    );

    batchedErpProducts.forEach((erpProduct) => {
      if (erpProduct) erpProducts.push(erpProduct);
    });
  }
  writeStdOut("Finished fetching products", true);

  await writeFile(
    "./scripts/data/missingErpProducts.json",
    JSON.stringify(missingErpProducts, null, 2)
  );
  await writeFile(
    "./scripts/data/erpProducts.json",
    JSON.stringify(erpProducts, null, 2)
  );
  console.log({
    missingErpProducts: missingErpProducts.length,
    erpProducts: erpProducts.length,
  });
};
