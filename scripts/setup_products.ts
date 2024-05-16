import prisma from "../db/index.js";
import { tiendaNube } from "../dataSources/tiendaNube/index.js";
import { Product as TiendaNubeProduct } from "../dataSources/tiendaNube/types.js";
import { Prisma } from "@prisma/client";
import { saveLogs } from "../log/index.js";

export const setupProducts = async () => {
  await cleanupDatabase();

  const tnProducts = await getTiendaNubeProducts();

  await saveProducts(tnProducts);
};

async function cleanupDatabase() {
  console.log("Database cleanup...");
  await prisma.tNProduct.deleteMany();
  await prisma.tNDuplicatedCodes.deleteMany();
  console.log("Database cleanup complete!");
}

async function getTiendaNubeProducts() {
  console.log("Getting TiendaNube products...");
  const products = await tiendaNube.getAllProducts();
  console.log("TiendaNube products retrieved!");

  saveLogs([
    {
      type: "info",
      message: `Se encontraron ${products.length} productos en TiendaNube`,
      data: undefined,
    },
  ]);

  return products;
}

async function saveProducts(tnProducts: TiendaNubeProduct[]) {
  console.log("Saving products to database...");
  const productsMap = new Map<string, TiendaNubeProduct[]>();
  for (const product of tnProducts) {
    const variant = product.variants[0];
    if (!variant) continue;
    const code = variant.sku;
    if (!code) continue;
    const existing = productsMap.get(code.toUpperCase()) || [];

    productsMap.set(code.toUpperCase(), [...existing, product]);
  }

  const productsToSave: Prisma.TNProductCreateManyInput[] = [];
  const duplicatedCodes: string[] = [];
  for (const [code, products] of productsMap) {
    if (products.length > 1) {
      duplicatedCodes.push(code);
      continue;
    }
    const product = products[0];
    const variant = product.variants[0];
    if (!variant) continue;
    productsToSave.push({
      productId: product.id,
      variantId: variant.id,
      code,
      stock: 0,
      active: product.published,
      createdAt: new Date(product.created_at),
    });
  }

  await prisma.tNProduct.createMany({
    data: productsToSave,
  });

  console.log("Products saved to database!");

  await prisma.tNDuplicatedCodes.createMany({
    data: duplicatedCodes.map((code) => ({ code })),
  });
}
