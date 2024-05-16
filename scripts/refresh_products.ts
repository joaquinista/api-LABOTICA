import prisma from "../db/index.js";
import { tiendaNube } from "../dataSources/tiendaNube/index.js";
import { Product as TiendaNubeProduct } from "../dataSources/tiendaNube/types.js";
import { Prisma } from "@prisma/client";
import { saveLogs } from "../log/index.js";

export const refreshProducts = async () => {
  const tnProducts = await getTiendaNubeProducts();
  const dbProducts = await prisma.tNProduct.findMany();

  const productsMap = new Map<string, TiendaNubeProduct[]>();
  for (const product of tnProducts) {
    const variant = product.variants[0];
    if (!variant) continue;
    const code = variant.sku;
    if (!code) continue;
    const existing = productsMap.get(code.toUpperCase()) || [];

    productsMap.set(code.toUpperCase(), [...existing, product]);
  }

  const productsToRefresh: {
    active: boolean;
    productId: number;
  }[] = [];
  for (const [_code, products] of productsMap) {
    if (products.length > 1) continue;

    const product = products[0];
    const variant = product.variants[0];
    if (!variant) continue;

    const dbProduct = dbProducts.find((p) => p.productId === product.id);
    if (!dbProduct) continue;

    if (
      dbProduct.active === false &&
      product.published === true &&
      variant.weight &&
      parseFloat(variant.weight) > 0
    ) {
      productsToRefresh.push({
        productId: dbProduct.productId,
        active: product.published,
      });
    }
  }

  await prisma.$transaction([
    ...productsToRefresh.map(({ productId, active }) =>
      prisma.tNProduct.update({
        where: { productId },
        data: { active },
      })
    ),
  ]);
};

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
