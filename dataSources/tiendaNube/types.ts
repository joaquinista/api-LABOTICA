export type Product = {
  id: number;
  published: boolean;
  name: {
    es: string;
  };
  interDataCode: number | null | undefined;
  created_at: string;
  variants: [
    {
      id: number;
      image_id: number | null;
      product_id: number;
      position: number;
      price: string | null;
      compare_at_price: string | null;
      promotional_price: string | null;
      stock_management: boolean;
      stock: number;
      weight: string | null;
      width: string | null;
      height: string | null;
      depth: string | null;
      sku: string | null;
      values: [];
      barcode: string | null;
      updated_at: string;
      inventory_levels: [
        {
          id: number;
          variant_id: number;
          location_id: string;
          stock: number;
        }
      ];
    }
  ];
  categories: {
    id: number;
  }[];
  images?: {
    id: number;
  }[];
};

export type GetProductsResponse = Product[];

export type PatchStockPriceInput = {
  id: number;
  variants: {
    id: number;
    price?: number | undefined;
    inventory_levels: {
      stock: number;
    }[];
  }[];
}[];

export type UpdateProductsInput = {
  productId: number;
  variantId: number;
  weight: string;
  height?: string;
  width?: string;
  depth?: string;
}[];

export type UploadProductsPicsInput = {
  oldWebId: number;
  imageName: string;
  productId: number;
  src: string;
  position: number;
}[];

export type DeleteProductPicsInput = { productId: number; imageId: number }[];

export type Order = {
  id: number;
  created_at: string;
  contact_email: string;
  contact_name: string;
  contact_phone: string;
  contact_identification: string | null;
  billing_name: string;
  billing_phone: string;
  billing_address: string;
  billing_number: string;
  billing_floor: string | null;
  billing_locality: string | null;
  billing_zipcode: string;
  billing_city: string;
  billing_province: string;
  billing_country: string;
  customer: {
    id: number;
    email: string;
    name: string;
    phone: string;
    identification: string;
    billing_name: string;
    billing_phone: string;
    billing_address: string;
    billing_number: string;
    billing_floor: string | null;
    billing_locality: string | null;
    billing_zipcode: string;
    billing_city: string;
    billing_province: string;
    billing_country: string;
  };
  shipping_option: string | null;
  gateway_name: string | null;
  shipping_address: Address;
  shipping_cost_customer: string | null;
  number: number;
  products: {
    price: string;
    product_id: number;
    quantity: number;
    sku: string | null;
  }[];
  discount: string | null;
};

export type Address = {
  address: null | string;
  city: string;
  country: string;
  created_at: string;
  default: boolean;
  floor: null | string;
  id: number;
  locality: string;
  name: string;
  number: null | string;
  phone: string;
  province: string;
  updated_at: string;
  zipcode: string;
  customs?: null;
};
