import { CronJob } from "cron";
import { tiendaNube } from "../../../dataSources/tiendaNube/index.js";
import {
  PatchStockPriceInput,
  Product as TiendaNubeProduct,
} from "../../../dataSources/tiendaNube/types.js";
import prisma from "../../../db/index.js";
import { Prisma } from "@prisma/client";
import { erp } from "../../../dataSources/erp/index.js";
import { sendEmail } from "../../../mail/index.js";
import { saveLogs } from "../../../log/index.js";

const job = async () => {
  console.log("Getting new products from TiendaNube...");
  const logs: Prisma.LogCreateManyInput[] = [];
  const lastTnProduct = await prisma.tNProduct.findFirstOrThrow({
    orderBy: {
      createdAt: "desc",
    },
  });

  const tiendaNubeProducts = await tiendaNube.getAllProducts({
    created_at_min: lastTnProduct.createdAt.toISOString(),
  });

  console.log("Saving products to database...");
  const productsMap = new Map<string, TiendaNubeProduct[]>();
  for (const product of tiendaNubeProducts) {
    const variant = product.variants[0];
    if (!variant) continue;
    const code = variant.sku?.toUpperCase();
    if (!code) continue;
    const existing = productsMap.get(code) || [];

    productsMap.set(code, [...existing, product]);
  }

  const productsToSave: Prisma.TNProductCreateManyInput[] = [];
  const productsToPatch: PatchStockPriceInput = [];
  const duplicatedCodes: string[] = [];
  for (const [code, products] of productsMap) {
    if (products.length > 1) {
      duplicatedCodes.push(code);
      continue;
    }
    const product = products[0];
    const variant = product.variants[0];
    if (!variant) continue;

    const erpProduct = await erp.getOneProduct(code);
    if (!erpProduct) {
      logs.push({
        message: `Product ${code} not found in ERP`,
        type: "error",
      });
      sendEmail(`Product ${code} not found in ERP`);
      continue;
    }

    if (product.id === lastTnProduct.productId) continue;

    productsToSave.push({
      productId: product.id,
      variantId: variant.id,
      code,
      stock: 0,
      active: product.published,
      createdAt: new Date(product.created_at),
      interdataCode: erpProduct.prd_codigo,
    });
    productsToPatch.push({
      id: product.id,
      variants: [
        {
          id: variant.id,
          price: erpProduct.prd_pvp_con_iva,
          inventory_levels: [
            {
              stock: erpProduct.prd_stock,
            },
          ],
        },
      ],
    });
  }

  if (productsToSave.length === 0) {
    console.log("No new products found");
    return;
  }

  await prisma.tNProduct.createMany({
    data: productsToSave,
  });

  await tiendaNube.patchStockPrice(productsToPatch).catch((e) => {
    void sendEmail(`Error patching stock and prices: ${e.message}`);
    void saveLogs([
      {
        message: `Error patching stock and prices: ${e.message}`,
        type: "error",
        data: JSON.stringify(productsToPatch),
      },
    ]);
  });

  console.log("Products saved to database and stock updated!");

  logs.push({
    message: `Saved ${productsToSave.length} new products`,
    type: "info",
    data: JSON.stringify(productsToSave),
  });
  await saveLogs(logs);

  await prisma.tNDuplicatedCodes.createMany({
    data: duplicatedCodes.map((code) => ({ code })),
  });
};

export default {
  name: "registerNewProducts",
  cronJob: new CronJob("3/5 * * * *", job),
  run: job,
};
