import {
  CreateOrderInput,
  GetOneProductResponse,
  GetProductsResponse,
  GetStockUpdatesResponse,
} from "./types.js";

const BASE_URL = process.env.ERP_URL;
const PASSWD = process.env.ERP_PASSWD;
const USER = process.env.ERP_USER;

if (!BASE_URL || !PASSWD || !USER) {
  throw new Error("Configuración del ERP incompleta. Revisar .env.");
}

const headers = {
  "Content-Type": "text/plain",
};

const formatDate = (date: Date, options: { time?: boolean } = {}) =>
  `${date.getDate().toString().padStart(2, "0")}-${(date.getMonth() + 1)
    .toString()
    .padStart(2, "0")}-${date.getFullYear()}` +
  (options.time
    ? ` ${date.getHours().toString().padStart(2, "0")}:${date
        .getMinutes()
        .toString()
        .padStart(2, "0")}:${date.getSeconds().toString().padStart(2, "0")}`
    : "");

const getAllProducts = async ({
  updatedAfter,
  updatedBefore,
}: {
  updatedAfter?: Date;
  updatedBefore?: Date;
} = {}) => {
  const startedAt = Date.now();
  const response = await fetch(`${BASE_URL}/productoConsultaPorSector`, {
    headers,
    method: "POST",
    body: JSON.stringify({
      empresa: parseInt(USER),
      passwd: PASSWD,
      sector: 1,
      deposito: 2,
      solo_productos_actualizados: updatedAfter ? 1 : undefined,
      productos_actualizados_fec_ini: updatedAfter
        ? formatDate(updatedAfter)
        : undefined,
      productos_actualizados_fec_fin: updatedBefore
        ? formatDate(updatedBefore)
        : undefined,
    }),
  });

  if (!response.ok) {
    console.error(response.text());
    throw new Error(
      `Error al obtener los productos del ERP: ${response.statusText}`
    );
  }

  const data = (await response.json().catch((err) => {
    console.error(response.text());
    throw new Error(`Error al parsear la respuesta del ERP: ${err}`);
  })) as GetProductsResponse;

  // filter products with repeated prd_code
  const ids = new Set<number>();
  const products = data.vProductos.filter((product) => {
    if (ids.has(product.prd_codigo)) return false;
    ids.add(product.prd_codigo);
    return true;
  });

  console.log(
    `Fetched ${products.length} products in ${
      (Date.now() - startedAt) / 1000
    }s...`
  );

  return products;
};

const RETRY_DELAY = 100;
const MAX_RETRIES = 1;

const getOneProduct = async (code: string) => {
  let retries = 0;
  let response: Response | undefined = undefined;
  let data: GetOneProductResponse | undefined;

  while (retries < MAX_RETRIES) {
    response = await fetch(`${BASE_URL}/productoConsultaPorCodigo`, {
      headers,
      method: "POST",
      body: JSON.stringify({
        empresa: parseInt(USER),
        passwd: PASSWD,
        producto: code,
        con_foto: 0,
        tipo_codigo: 1,
        deposito: 2,
        lista_cod: 1,
      }),
    });

    if (response.ok) {
      data = (await response.json()) as GetOneProductResponse;

      if (data.descripcion === "OK") break;

      data = undefined;
    }

    retries++;
    console.error(
      `Error al obtener el producto ${code} del ERP: ${response.statusText}. Retrying...`
    );
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
  }

  return data;
};

const createOrder = async (
  order: CreateOrderInput,
  {
    onSuccess,
    onError,
  }: {
    onSuccess?: (order: CreateOrderInput) => void;
    onError?: (order: CreateOrderInput, error: Error) => void;
  } = {}
) => {
  const response = await fetch(`${BASE_URL}/np_crear`, {
    headers,
    method: "POST",
    body: JSON.stringify({
      empresa: parseInt(USER),
      passwd: PASSWD,
      ...order,
    }),
  });

  const data = (await response.json().catch((err) => ({
    estado: 1,
    descripcion: "Error al parsear la respuesta del ERP: ${err}",
  }))) as { estado: number; descripcion: string };

  if (!response.ok) {
    onError?.(
      order,
      new Error(
        `Error al crear la orden en el ERP: status > ${response.statusText}`
      )
    );
    return;
  }

  if (data.estado !== 0 && data.estado !== 6) {
    onError?.(
      order,
      new Error(
        `Error al crear la orden en el ERP: Descripción > ${
          data.descripcion
        } text: ${JSON.stringify(data)}`
      )
    );
    return;
  }

  onSuccess?.(order);

  return true;
};

const getStockUpdates = async ({
  updatedAfter,
  updatedBefore,
}: {
  updatedAfter?: Date;
  updatedBefore?: Date;
} = {}) => {
  if (updatedAfter && updatedBefore)
    console.log(
      `requested stocks with ${formatDate(updatedAfter, {
        time: true,
      })} and ${formatDate(updatedBefore, { time: true })}`
    );
  const response = await fetch(`${BASE_URL}/productoConsultaStock`, {
    headers,
    method: "POST",
    body: JSON.stringify({
      empresa: parseInt(USER),
      passwd: PASSWD,
      deposito: 2,
      productos_actualizados_fec_ini: updatedAfter
        ? formatDate(updatedAfter, { time: true })
        : undefined,
      productos_actualizados_fec_fin: updatedBefore
        ? formatDate(updatedBefore, { time: true })
        : undefined,
    }),
  });

  if (!response.ok) {
    console.error(response.text());
    throw new Error(
      `Error al obtener los productos del ERP: ${response.statusText}`
    );
  }

  const data = (await response.json().catch((err) => {
    console.error(response.text());
    throw new Error(`Error al parsear la respuesta del ERP: ${err}`);
  })) as GetStockUpdatesResponse;

  console.log(`Fetched ${data.vProductos.length} products`);

  return data.vProductos;
};

export const erp = {
  getAllProducts,
  getOneProduct,
  createOrder,
  getStockUpdates,
};
