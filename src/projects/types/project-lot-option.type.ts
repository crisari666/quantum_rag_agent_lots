/**
 * Single lot configuration: area, COP sale `price`, optional USD reference `priceUsd`.
 */
export type ProjectLotOption = Readonly<{
  area: number;
  price: number;
  priceUsd?: number;
}>;
