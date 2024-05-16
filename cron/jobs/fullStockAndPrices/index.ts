import { CronJob } from "cron";
import { erp } from "../../../dataSources/erp/index.js";
import prisma from "../../../db/index.js";
import { GetOneProductResponse } from "../../../dataSources/erp/types.js";
import { writeFile } from "fs/promises";
import { writeStdOut } from "../../../utils/writeStdOut.js";
import { tiendaNube } from "../../../dataSources/tiendaNube/index.js";
import { PatchStockPriceInput } from "../../../dataSources/tiendaNube/types.js";
import { sendEmail } from "../../../mail/index.js";

const job = async () => {
  const tnProducts = await prisma.tNProduct.findMany({
    where: {
      active: true,
    },
  });

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

  const erpProductsMap = new Map<string, GetOneProductResponse>();
  erpProducts.forEach((product) =>
    erpProductsMap.set(product.prd_alterna.toUpperCase(), product)
  );

  const productsToPatch: PatchStockPriceInput = tnProducts
    .filter((product) => erpProductsMap.has(product.code))
    .map((product): PatchStockPriceInput[0] => {
      const erpProduct = erpProductsMap.get(product.code);
      if (!erpProduct) throw new Error("Product not found in ERP");
      return {
        id: product.productId,
        variants: [
          {
            id: product.variantId,
            price: erpProduct.prd_pvp_con_iva,
            inventory_levels: [
              {
                stock: erpProduct.prd_stock,
              },
            ],
          },
        ],
      };
    });

  await writeFile(
    "./cron/jobs/fullStockAndPrices/productsToPatch.json",
    JSON.stringify(productsToPatch)
  );

  const patchedProducts = await tiendaNube
    .patchStockPrice(productsToPatch)
    .catch((e) => {
      void sendEmail(`Error patching stock and prices: ${e.message}`);
      return [];
    });

  const updatedTnProducts = await prisma.$transaction(
    patchedProducts.map((product) =>
      prisma.tNProduct.update({
        where: {
          productId: product.id,
        },
        data: {
          stock: product.variants[0].inventory_levels[0].stock,
        },
      })
    )
  );

  console.log(`Updated ${updatedTnProducts.length} products`);

  await writeFile(
    "./cron/jobs/fullStockAndPrices/patchedProducts.json",
    JSON.stringify(patchedProducts)
  );
};

export default {
  name: "full-stock-and-prices",
  cronJob: new CronJob("20 23,5 * * *", job),
  run: job,
};
