import fs from "fs/promises";
import { Prisma } from "@prisma/client";
import {
  DeleteProductPicsInput,
  UploadProductsPicsInput,
} from "../dataSources/tiendaNube/types.js";
import { tiendaNube } from "../dataSources/tiendaNube/index.js";
import { saveLogs } from "../log/index.js";
import winston from "winston";
import { writeStdOut } from "../utils/writeStdOut.js";

const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  defaultMeta: { service: "user-service" },
  transports: [new winston.transports.File({ filename: "logs/fixImages.log" })],
});

type ProductPic = {
  producto_id: number | null;
  foto: string;
};
type OldWebIdToCode = {
  id: number;
  codigo: string;
};
type UploadedImage = {
  productId: number;
  imageName: string;
};

export const fixImages = async () => {
  const oldWebIdToCodeMap = await fs
    .readFile("./scripts/data/oldWebIdsToCodes.json", "utf-8")
    .then((data) => JSON.parse(data) as OldWebIdToCode[])
    .then((data) => new Map(data.map((p) => [p.id, p.codigo.toUpperCase()])));

  const codeToOldWebIdMap = new Map(
    [...oldWebIdToCodeMap].map(([k, v]) => [v, k])
  );

  const productsPics = await fs
    .readFile("./scripts/data/images.json", "utf-8")
    .then((data) => JSON.parse(data) as ProductPic[])
    .then((data) =>
      data
        .filter((pp) => pp.foto)
        .map((pp) => {
          const code = oldWebIdToCodeMap.get(pp.producto_id || 0);
          return { ...pp, code };
        })
    );

  // const uploadedImages = await fs
  //   .readFile("./scripts/data/uploadedImages.json", "utf-8")
  //   .then((data) => JSON.parse(data) as UploadedImage[]);

  const productsWithImages = await tiendaNube.getAllProducts({
    withImages: true,
    published: true,
  });

  const productsWithMissingImages: {
    code: string;
    oldWebId: number;
    missingImages: ProductPic[];
    currentImages: number[];
    productId: number;
  }[] = [];
  for (const product of productsWithImages) {
    const oldWebId = codeToOldWebIdMap.get(
      product.variants[0].sku?.toUpperCase() || ""
    );
    if (!oldWebId) continue;
    const productPics = productsPics.filter(
      (pp) => pp.producto_id === oldWebId
    );
    if (
      typeof product.images?.length === "number" &&
      product.images.length < productPics.length
    ) {
      productsWithMissingImages.push({
        productId: product.id,
        code: product.variants[0].sku || "",
        oldWebId,
        missingImages: productPics,
        currentImages: product.images.map((i) => i.id),
      });
    }
  }

  const logs: Prisma.LogCreateManyInput[] = [];

  const picsToDelete: DeleteProductPicsInput = [];
  for (const product of productsWithMissingImages) {
    for (const image of product.currentImages) {
      picsToDelete.push({
        productId: product.productId,
        imageId: image,
      });
    }
  }

  await tiendaNube.deleteProductPics(picsToDelete, {
    onError(item, error) {
      logs.push({
        message: `Error deleting product pic ${item.imageId} from product ${item.productId}: ${error.message}`,
        type: "error",
      });
    },
  });

  const picsToUpload: UploadProductsPicsInput = [];
  for (const product of productsWithMissingImages) {
    let pos = 1;
    for (const image of product.missingImages) {
      picsToUpload.push({
        productId: product.productId,
        src: `https://mayoristas.boticadelpastelero.com.ar/uploads/productos/${image.foto}`,
        position: pos,
        imageName: image.foto,
        oldWebId: product.oldWebId,
      });
      pos++;
    }
  }

  await tiendaNube.uploadProductPics(picsToUpload, {
    onSuccess(item) {
      logger.info(
        `Uploaded image ${item.imageName} to product ${item.oldWebId}`,
        { data: item }
      );
    },
    onError(item, error) {
      logs.push({
        message: `Error uploading product pic ${item.src} to product ${item.productId}: ${error.message}`,
        type: "error",
      });
      logger.error(
        `Error uploading image ${item.src} to product ${item.productId}: ${error.message}`,
        { data: item }
      );
    },
  });

  // await fs.writeFile(
  //   "./scripts/data/uploadedImages.json",
  //   JSON.stringify(uploadedImages, null, 2)
  // );

  await saveLogs(logs);
};
