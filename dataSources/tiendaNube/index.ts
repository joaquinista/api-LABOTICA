import {
  DeleteProductPicsInput,
  GetProductsResponse,
  Order,
  PatchStockPriceInput,
  UpdateProductsInput,
  UploadProductsPicsInput,
} from "./types.js";
import { writeStdOut } from "../../utils/writeStdOut.js";

const BASE_URL = process.env.TIENDANUBE_URL; // URL base de la API de TiendaNube
const TOKEN = process.env.TIENDANUBE_TOKEN; // Token de acceso a la API de TiendaNube
const TOKEN2 = process.env.TIENDANUBE_TOKEN2; // Token 2 de acceso a la API de TiendaNube
const TOKEN3 = process.env.TIENDANUBE_TOKEN3; // Token 3 de acceso a la API de TiendaNube
const TOKEN4 = process.env.TIENDANUBE_TOKEN4; // Token 4 de acceso a la API de TiendaNube
const TOKEN5 = process.env.TIENDANUBE_TOKEN5; // Token 5 de acceso a la API de TiendaNube

if (!TOKEN || !BASE_URL || !TOKEN2 || !TOKEN3 || !TOKEN4 || !TOKEN5) {
  throw new Error("No se encontró el token de TiendaNube");
}

const TOKENS = [TOKEN, TOKEN2, TOKEN3, TOKEN4, TOKEN5];

const headers = {
  Authentication: `bearer ${TOKEN}`,
  "User-Agent": "prueba (gustavo@digitalmix.ar)",
};

const getAllProducts = async (
  opts: {
    withImages?: boolean;
    published?: boolean;
    created_at_min?: string;
  } = {}
) => {
  const products: GetProductsResponse = [];
  const ids = new Set<number>();
  let page = 1;

  const { data, totalPages } = await getOneProductsPage(page, {
    tokenToUse: TOKEN,
    withImages: opts.withImages,
    published: opts.published,
    created_at_min: opts.created_at_min,
  });

  data
    .filter((p) => !p.categories.some((c) => c.id === 22860322))
    .forEach((product) => {
      if (!ids.has(product.id)) {
        products.push(product);
        ids.add(product.id);
      }
    });

  page++;
  while (page <= totalPages) {
    await Promise.all(
      TOKENS.map(async (token, i) => {
        if (page + i <= totalPages) {
          const { data } = await getOneProductsPage(page + i, {
            tokenToUse: token,
            withImages: opts.withImages,
            published: opts.published,
            created_at_min: opts.created_at_min,
          });
          data
            .filter((p) => !p.categories.some((c) => c.id === 22860322))
            .forEach((product) => {
              if (!ids.has(product.id)) {
                products.push(product);
                ids.add(product.id);
              }
            });
          page++;
        }
      })
    );
  }

  console.log(`Fetched ${products.length} products...`);

  return products;
};

const getOneProductsPage = async (
  page: number,
  opts: {
    withImages?: boolean;
    published?: boolean;
    created_at_min?: string;
    tokenToUse: string;
  } = {
    tokenToUse: TOKEN,
  }
) => {
  const urlParams = new URLSearchParams({
    per_page: "200",
    fields:
      "id,variants,published,name,categories,created_at" +
      (opts.withImages ? ",images" : ""),
  });
  if (opts.published !== undefined) {
    urlParams.set("published", opts.published ? "true" : "false");
  }
  if (opts.created_at_min) {
    urlParams.set("created_at_min", opts.created_at_min);
  }
  urlParams.set("page", page.toString());
  const response = await fetch(`${BASE_URL}/products?${urlParams.toString()}`, {
    headers: {
      ...headers,
      Authentication: `bearer ${opts.tokenToUse}`,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Error al obtener los productos de TiendaNube: ${response.statusText}`
    );
  }

  await waitRequestLimit(response);

  const totalCount = response.headers.get("X-Total-Count");

  if (!totalCount) throw new Error("No se encontró el header X-Total-Count");

  let totalPages = Math.ceil(parseInt(totalCount) / 200);

  const data = (await response.json().catch((err) => {
    console.error(response.text());
    throw new Error(`Error al parsear la respuesta de TiendaNube: ${err}`);
  })) as GetProductsResponse;

  console.log(`Fetched page ${page} of ${totalPages}...`);
  page++;

  return { data, totalPages };
};

const patchStockPrice = async (
  products: PatchStockPriceInput,
  opts: { usedToken?: 1 | 2 } = {}
) => {
  const currentBatch = products.slice(0, 50);
  const rest = products.slice(50);
  const patchedProducts: PatchStockPriceInput = [];

  const response = await fetch(`${BASE_URL}/products/stock-price`, {
    method: "PATCH",
    headers: {
      ...headers,
      "Content-Type": "application/json",
      Authentication: `bearer ${opts.usedToken === 2 ? TOKEN2 : TOKEN}`,
    },
    body: JSON.stringify(currentBatch),
  });

  if (!response.ok) {
    throw new Error(
      `Error al actualizar el stock y precio de los productos: ${response.statusText}`
    );
  }

  patchedProducts.push(...currentBatch);

  if (rest.length) {
    writeStdOut(
      `Patched ${currentBatch.length} products. ${rest.length} remaining...`
    );
    await waitRequestLimit(response);
    const restPatchedProducts = await patchStockPrice(rest);
    patchedProducts.push(...restPatchedProducts);
  } else {
    writeStdOut(`Patched ${currentBatch.length} products.`, true);
  }

  return patchedProducts;
};

const updateProducts = async (
  data: UpdateProductsInput,
  opts: { usedToken?: 1 | 2 } = {}
) => {
  let i = 0;
  for (const product of data) {
    await fetch(`${BASE_URL}/products/${product.productId}`, {
      method: "PUT",
      headers: {
        ...headers,
        "Content-Type": "application/json",
        Authentication: `bearer ${TOKEN5}`,
      },
      body: JSON.stringify({
        published: true,
      }),
    }).then((response) => waitRequestLimit(response));

    const response = await fetch(
      `${BASE_URL}/products/${product.productId}/variants/${product.variantId}`,
      {
        method: "PUT",
        headers: {
          ...headers,
          "Content-Type": "application/json",
          Authentication: `bearer ${TOKEN5}`,
        },
        body: JSON.stringify({
          weight: product.weight,
          height: product.height,
          width: product.width,
          depth: product.depth,
        }),
      }
    );

    await waitRequestLimit(response);

    if (!response.ok) {
      throw new Error(
        `Error al actualizar el producto ${product.productId} de TiendaNube: ${response.statusText}`
      );
    }

    writeStdOut(
      `Updated product ${i + 1} of ${data.length}...`,
      i === data.length - 1
    );
    i++;
  }
};

const uploadProductPics = async (
  data: UploadProductsPicsInput,
  {
    onSuccess,
    onError,
  }: {
    onSuccess?: (item: UploadProductsPicsInput[number]) => void;
    onError?: (item: UploadProductsPicsInput[number], error: Error) => void;
  } = {}
) => {
  let i = 0;
  let queue: Promise<void>[] = [];
  for (const productPic of data) {
    const tokenToUse = TOKENS[i % 5];
    if (!tokenToUse) throw new Error("No se encontró el token de TiendaNube");
    queue.push(
      fetch(`${BASE_URL}/products/${productPic.productId}/images`, {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
          Authentication: `bearer ${tokenToUse}`,
        },
        body: JSON.stringify({
          src: productPic.src,
        }),
      }).then(async (response) => {
        await waitRequestLimit(response);
        if (!response.ok) {
          onError?.(
            productPic,
            new Error(
              `Error al subir la imagen ${productPic.src} al producto ${
                productPic.productId
              } de TiendaNube: ${await response.text()}`
            )
          );
        } else {
          onSuccess?.(productPic);
        }
      })
    );

    if (queue.length >= 5) {
      await Promise.all(queue);
      queue = [];
    }

    writeStdOut(
      `Uploaded image ${i + 1} of ${data.length}...`,
      i === data.length - 1
    );
    i++;
  }

  await Promise.all(queue);
  writeStdOut(`Uploaded ${data.length} images...`, true);
};

const deleteProductPics = async (
  imgs: DeleteProductPicsInput,
  {
    onSuccess,
    onError,
    usedToken,
  }: {
    onSuccess?: (item: DeleteProductPicsInput[number]) => void;
    onError?: (item: DeleteProductPicsInput[number], error: Error) => void;
    usedToken?: 1 | 2;
  } = {}
) => {
  let i = 0;
  for (const img of imgs) {
    const response = await fetch(
      `${BASE_URL}/products/${img.productId}/images/${img.imageId}`,
      {
        method: "DELETE",
        headers: {
          ...headers,
          Authentication: `bearer ${usedToken === 2 ? TOKEN2 : TOKEN}`,
        },
      }
    );

    await waitRequestLimit(response);

    if (!response.ok) {
      onError?.(
        img,
        new Error(
          `Error al borrar la imagen ${img.imageId} del producto ${
            img.productId
          } de TiendaNube: ${await response.text()}`
        )
      );
    } else {
      onSuccess?.(img);
    }

    writeStdOut(
      `Deleted image ${i + 1} of ${imgs.length}...`,
      i === imgs.length - 1
    );
    i++;
  }
};

const dayInMs = 24 * 60 * 60 * 1000;

export const getNewOrders = async (opts: { sinceId?: number } = {}) => {
  const urlParams = new URLSearchParams({
    per_page: "200",
  });

  if (opts.sinceId) {
    urlParams.set("since_id", opts.sinceId.toString());
  } else {
    urlParams.set(
      "created_at_min",
      new Date(new Date().getTime() - dayInMs * 4).toISOString()
    );
  }

  const response = await fetch(`${BASE_URL}/orders?${urlParams.toString()}`, {
    headers: {
      ...headers,
      Authentication: `bearer ${TOKEN}`,
    },
  });

  if (!response.ok) {
    console.error(
      `Error al obtener las órdenes de TiendaNube: ${response.statusText}`
    );
    return [];
  }

  const data = (await response.json().catch((err) => {
    console.error(response.text());
    throw new Error(`Error al parsear la respuesta de TiendaNube: ${err}`);
  })) as Order[];

  return data;
};

const deleteProduct = async (id: number) => {
  const response = await fetch(`${BASE_URL}/products/${id}`, {
    method: "DELETE",
    headers: {
      ...headers,
      Authentication: `bearer ${TOKEN5}`,
    },
  });

  await waitRequestLimit(response);

  if (!response.ok) {
    console.error(
      `Error al borrar el producto ${id} de TiendaNube: ${response.statusText}`
    );
  }
  console.log(`Deleted product ${id}...`);
};

export const tiendaNube = {
  getAllProducts,
  patchStockPrice,
  updateProducts,
  uploadProductPics,
  deleteProductPics,
  getNewOrders,
  deleteProduct,
};

const waitRequestLimit = async (response: Response) => {
  const remaining = parseInt(
    response.headers.get("X-Rate-Limit-Remaining") || "0"
  );
  const time = parseInt(response.headers.get("X-Rate-Limit-Reset") || "1000");
  if (remaining < 5 && response.ok) {
    writeStdOut(`Waiting for request limit reset... (ms: ${time})`);
    await new Promise((resolve) => setTimeout(resolve, time));
  }
};
