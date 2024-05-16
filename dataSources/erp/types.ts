export type ResponseInfo = {
  estado: number;
  descripcion: string;
  fecha: string;
};

export type Product = {
  prd_id: number;
  prd_codigo: number;
  prd_nombre: string;
  prd_alterna: string;
  prd_cod_bar: string;
  prd_sector: number;
  prd_rubro: number;
  prd_linea: number;
  prd_marca: number;
  prd_alic_iva: number;
  prd_pvp_sin_iva: number;
  prd_pvp_con_iva: number;
  prd_stock: number;
  prd_en_oferta: null;
  prd_peso_kgr: number | null;
  prd_aforo_alto: null;
  prd_aforo_ancho: null;
  prd_aforo_profundo: null;
  prd_muestra_precio: null;
  prd_agr_uni: string;
  prd_estado: number;
  prd_observa: null;
};

export type GetProductsResponse = ResponseInfo & {
  vProductos: Product[];
};

export type GetOneProductResponse = Product &
  ResponseInfo & {
    prd_sector_nom: string;
    prd_rubro_nom: string;
    prd_linea_nom: string;
    prd_marca_nom: string;
    prd_propiedad: number;
  };

export type CreateOrderInput = {
  fecha_emision: string;
  cliente_nombre: string;
  cliente_doc_tipo: number;
  cliente_nro_doc: number;
  cliente_domicilio: string;
  cliente_codigo_postal: string;
  cliente_email: string;
  cliente_telefono: string;
  forma_de_envio: string;
  forma_de_pago: string;
  lugar_de_entrega: string;
  observaciones: string;
  pk_id: number;
  productos: {
    producto_codigo: number;
    producto_cod_alternativo?: string;
    producto_precio_unitario: number;
    producto_cantidad: number;
  }[];
};

export type GetStockUpdatesResponse = ResponseInfo & {
  vProductos: {
    prd_codigo: number;
    prd_stock: number;
  }[];
};
