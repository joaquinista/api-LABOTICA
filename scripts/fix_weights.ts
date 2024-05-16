import { Prisma } from "@prisma/client";
import fs, { writeFile } from "fs/promises";
import { saveLogs } from "../log/index.js";
import { writeStdOut } from "../utils/writeStdOut.js";
import prisma from "../db/index.js";
import { tiendaNube } from "../dataSources/tiendaNube/index.js";
import { UpdateProductsInput } from "../dataSources/tiendaNube/types.js";

const BASE_URL = process.env.TIENDANUBE_URL;
const TOKEN = process.env.TIENDANUBE_TOKEN;

if (!BASE_URL || !TOKEN) throw new Error("Missing env variables");

type ProductData = {
  id: number;
  weightKG: number;
  heightCM: number | null;
  widthCM: number | null;
  depthCM: number | null;
};

type OldWebIdToCode = {
  id: number;
  codigo: string;
};

export const fixWeights = async () => {
  const oldWebIdToCodeMap = await fs
    .readFile("./scripts/data/oldWebIdsToCodes.json", "utf-8")
    .then((data) => JSON.parse(data) as OldWebIdToCode[])
    .then(
      (data) => new Map(data.map((p) => [p.id, p.codigo.toUpperCase().trim()]))
    );

  const productsData = await fs
    .readFile("./scripts/data/weights.json", "utf-8")
    .then((data) => JSON.parse(data) as ProductData[]);

  const dbProducts = await prisma.tNProduct.findMany();
  const dbProductsMap = new Map(dbProducts.map((p) => [p.code, p]));

  const tnProducts = await tiendaNube.getAllProducts({
    published: false,
  });

  const logs: Prisma.LogCreateManyInput[] = [];

  const productsToUpdate: UpdateProductsInput = [];

  let index = 0;
  for (const product of productsData) {
    const productCode = oldWebIdToCodeMap.get(product.id);
    if (!productCode) {
      logs.push({
        message: `Product with oldWebId ${product.id} not found in map`,
        type: "warning",
      });
      continue;
    }
    const tnProduct = tnProducts.find(
      (p) => p.variants[0].sku?.toUpperCase() === productCode
    );
    if (!tnProduct) continue;

    if (tnProduct.published) continue;

    const dbProduct = dbProductsMap.get(productCode);
    if (!dbProduct) {
      logs.push({
        message: `Product with code ${productCode} not found in Tienda Nube`,
        type: "warning",
      });
      continue;
    }

    if (
      (tnProduct.variants[0].weight &&
        parseFloat(tnProduct.variants[0].weight) !== product.weightKG) ||
      tnProduct.published === false
    )
      productsToUpdate.push({
        productId: dbProduct.productId,
        variantId: dbProduct.variantId,
        weight: product.weightKG.toString(),
        height: product.heightCM?.toString() ?? undefined,
        width: product.widthCM?.toString() ?? undefined,
        depth: product.depthCM?.toString() ?? undefined,
      });

    index++;
  }

  console.log(`Products to update: ${productsToUpdate.length}`);

  // await writeFile(
  //   "./scripts/data/productsToUpdate.json",
  //   JSON.stringify(productsToUpdate, null, 2)
  // );

  await tiendaNube
    .updateProducts(productsToUpdate, { usedToken: 2 })
    .catch((err) => {
      void writeStdOut(`Error updating products in Tienda Nube: ${err}`);
      void saveLogs([
        {
          message: "Error updating products in Tienda Nube",
          type: "error",
          data: {
            error: err,
          },
        },
      ]);
    });

  await saveLogs(logs);
};
