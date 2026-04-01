import type * as runtime from "@prisma/client/runtime/client";
import type * as Prisma from "../internal/prismaNamespace";
/**
 * Model Vendor
 *
 */
export type VendorModel = runtime.Types.Result.DefaultSelection<Prisma.$VendorPayload>;
export type AggregateVendor = {
    _count: VendorCountAggregateOutputType | null;
    _avg: VendorAvgAggregateOutputType | null;
    _sum: VendorSumAggregateOutputType | null;
    _min: VendorMinAggregateOutputType | null;
    _max: VendorMaxAggregateOutputType | null;
};
export type VendorAvgAggregateOutputType = {
    lat: number | null;
    lng: number | null;
};
export type VendorSumAggregateOutputType = {
    lat: number | null;
    lng: number | null;
};
export type VendorMinAggregateOutputType = {
    id: string | null;
    user_id: string | null;
    shop_name: string | null;
    description: string | null;
    category: string | null;
    city: string | null;
    address: string | null;
    logo_url: string | null;
    lat: number | null;
    lng: number | null;
    is_verified: boolean | null;
    is_active: boolean | null;
    created_at: Date | null;
    updated_at: Date | null;
};
export type VendorMaxAggregateOutputType = {
    id: string | null;
    user_id: string | null;
    shop_name: string | null;
    description: string | null;
    category: string | null;
    city: string | null;
    address: string | null;
    logo_url: string | null;
    lat: number | null;
    lng: number | null;
    is_verified: boolean | null;
    is_active: boolean | null;
    created_at: Date | null;
    updated_at: Date | null;
};
export type VendorCountAggregateOutputType = {
    id: number;
    user_id: number;
    shop_name: number;
    description: number;
    category: number;
    city: number;
    address: number;
    logo_url: number;
    lat: number;
    lng: number;
    is_verified: number;
    is_active: number;
    created_at: number;
    updated_at: number;
    _all: number;
};
export type VendorAvgAggregateInputType = {
    lat?: true;
    lng?: true;
};
export type VendorSumAggregateInputType = {
    lat?: true;
    lng?: true;
};
export type VendorMinAggregateInputType = {
    id?: true;
    user_id?: true;
    shop_name?: true;
    description?: true;
    category?: true;
    city?: true;
    address?: true;
    logo_url?: true;
    lat?: true;
    lng?: true;
    is_verified?: true;
    is_active?: true;
    created_at?: true;
    updated_at?: true;
};
export type VendorMaxAggregateInputType = {
    id?: true;
    user_id?: true;
    shop_name?: true;
    description?: true;
    category?: true;
    city?: true;
    address?: true;
    logo_url?: true;
    lat?: true;
    lng?: true;
    is_verified?: true;
    is_active?: true;
    created_at?: true;
    updated_at?: true;
};
export type VendorCountAggregateInputType = {
    id?: true;
    user_id?: true;
    shop_name?: true;
    description?: true;
    category?: true;
    city?: true;
    address?: true;
    logo_url?: true;
    lat?: true;
    lng?: true;
    is_verified?: true;
    is_active?: true;
    created_at?: true;
    updated_at?: true;
    _all?: true;
};
export type VendorAggregateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Filter which Vendor to aggregate.
     */
    where?: Prisma.VendorWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of Vendors to fetch.
     */
    orderBy?: Prisma.VendorOrderByWithRelationInput | Prisma.VendorOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the start position
     */
    cursor?: Prisma.VendorWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` Vendors from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` Vendors.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Count returned Vendors
    **/
    _count?: true | VendorCountAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to average
    **/
    _avg?: VendorAvgAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to sum
    **/
    _sum?: VendorSumAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the minimum value
    **/
    _min?: VendorMinAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the maximum value
    **/
    _max?: VendorMaxAggregateInputType;
};
export type GetVendorAggregateType<T extends VendorAggregateArgs> = {
    [P in keyof T & keyof AggregateVendor]: P extends '_count' | 'count' ? T[P] extends true ? number : Prisma.GetScalarType<T[P], AggregateVendor[P]> : Prisma.GetScalarType<T[P], AggregateVendor[P]>;
};
export type VendorGroupByArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.VendorWhereInput;
    orderBy?: Prisma.VendorOrderByWithAggregationInput | Prisma.VendorOrderByWithAggregationInput[];
    by: Prisma.VendorScalarFieldEnum[] | Prisma.VendorScalarFieldEnum;
    having?: Prisma.VendorScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: VendorCountAggregateInputType | true;
    _avg?: VendorAvgAggregateInputType;
    _sum?: VendorSumAggregateInputType;
    _min?: VendorMinAggregateInputType;
    _max?: VendorMaxAggregateInputType;
};
export type VendorGroupByOutputType = {
    id: string;
    user_id: string;
    shop_name: string;
    description: string | null;
    category: string | null;
    city: string | null;
    address: string | null;
    logo_url: string | null;
    lat: number | null;
    lng: number | null;
    is_verified: boolean;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
    _count: VendorCountAggregateOutputType | null;
    _avg: VendorAvgAggregateOutputType | null;
    _sum: VendorSumAggregateOutputType | null;
    _min: VendorMinAggregateOutputType | null;
    _max: VendorMaxAggregateOutputType | null;
};
export type GetVendorGroupByPayload<T extends VendorGroupByArgs> = Prisma.PrismaPromise<Array<Prisma.PickEnumerable<VendorGroupByOutputType, T['by']> & {
    [P in ((keyof T) & (keyof VendorGroupByOutputType))]: P extends '_count' ? T[P] extends boolean ? number : Prisma.GetScalarType<T[P], VendorGroupByOutputType[P]> : Prisma.GetScalarType<T[P], VendorGroupByOutputType[P]>;
}>>;
export type VendorWhereInput = {
    AND?: Prisma.VendorWhereInput | Prisma.VendorWhereInput[];
    OR?: Prisma.VendorWhereInput[];
    NOT?: Prisma.VendorWhereInput | Prisma.VendorWhereInput[];
    id?: Prisma.StringFilter<"Vendor"> | string;
    user_id?: Prisma.StringFilter<"Vendor"> | string;
    shop_name?: Prisma.StringFilter<"Vendor"> | string;
    description?: Prisma.StringNullableFilter<"Vendor"> | string | null;
    category?: Prisma.StringNullableFilter<"Vendor"> | string | null;
    city?: Prisma.StringNullableFilter<"Vendor"> | string | null;
    address?: Prisma.StringNullableFilter<"Vendor"> | string | null;
    logo_url?: Prisma.StringNullableFilter<"Vendor"> | string | null;
    lat?: Prisma.FloatNullableFilter<"Vendor"> | number | null;
    lng?: Prisma.FloatNullableFilter<"Vendor"> | number | null;
    is_verified?: Prisma.BoolFilter<"Vendor"> | boolean;
    is_active?: Prisma.BoolFilter<"Vendor"> | boolean;
    created_at?: Prisma.DateTimeFilter<"Vendor"> | Date | string;
    updated_at?: Prisma.DateTimeFilter<"Vendor"> | Date | string;
    user?: Prisma.XOR<Prisma.UserScalarRelationFilter, Prisma.UserWhereInput>;
    products?: Prisma.ProductListRelationFilter;
    orders?: Prisma.OrderListRelationFilter;
    reviews?: Prisma.ReviewListRelationFilter;
    savedBy?: Prisma.SavedVendorListRelationFilter;
};
export type VendorOrderByWithRelationInput = {
    id?: Prisma.SortOrder;
    user_id?: Prisma.SortOrder;
    shop_name?: Prisma.SortOrder;
    description?: Prisma.SortOrderInput | Prisma.SortOrder;
    category?: Prisma.SortOrderInput | Prisma.SortOrder;
    city?: Prisma.SortOrderInput | Prisma.SortOrder;
    address?: Prisma.SortOrderInput | Prisma.SortOrder;
    logo_url?: Prisma.SortOrderInput | Prisma.SortOrder;
    lat?: Prisma.SortOrderInput | Prisma.SortOrder;
    lng?: Prisma.SortOrderInput | Prisma.SortOrder;
    is_verified?: Prisma.SortOrder;
    is_active?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    updated_at?: Prisma.SortOrder;
    user?: Prisma.UserOrderByWithRelationInput;
    products?: Prisma.ProductOrderByRelationAggregateInput;
    orders?: Prisma.OrderOrderByRelationAggregateInput;
    reviews?: Prisma.ReviewOrderByRelationAggregateInput;
    savedBy?: Prisma.SavedVendorOrderByRelationAggregateInput;
};
export type VendorWhereUniqueInput = Prisma.AtLeast<{
    id?: string;
    user_id?: string;
    AND?: Prisma.VendorWhereInput | Prisma.VendorWhereInput[];
    OR?: Prisma.VendorWhereInput[];
    NOT?: Prisma.VendorWhereInput | Prisma.VendorWhereInput[];
    shop_name?: Prisma.StringFilter<"Vendor"> | string;
    description?: Prisma.StringNullableFilter<"Vendor"> | string | null;
    category?: Prisma.StringNullableFilter<"Vendor"> | string | null;
    city?: Prisma.StringNullableFilter<"Vendor"> | string | null;
    address?: Prisma.StringNullableFilter<"Vendor"> | string | null;
    logo_url?: Prisma.StringNullableFilter<"Vendor"> | string | null;
    lat?: Prisma.FloatNullableFilter<"Vendor"> | number | null;
    lng?: Prisma.FloatNullableFilter<"Vendor"> | number | null;
    is_verified?: Prisma.BoolFilter<"Vendor"> | boolean;
    is_active?: Prisma.BoolFilter<"Vendor"> | boolean;
    created_at?: Prisma.DateTimeFilter<"Vendor"> | Date | string;
    updated_at?: Prisma.DateTimeFilter<"Vendor"> | Date | string;
    user?: Prisma.XOR<Prisma.UserScalarRelationFilter, Prisma.UserWhereInput>;
    products?: Prisma.ProductListRelationFilter;
    orders?: Prisma.OrderListRelationFilter;
    reviews?: Prisma.ReviewListRelationFilter;
    savedBy?: Prisma.SavedVendorListRelationFilter;
}, "id" | "user_id">;
export type VendorOrderByWithAggregationInput = {
    id?: Prisma.SortOrder;
    user_id?: Prisma.SortOrder;
    shop_name?: Prisma.SortOrder;
    description?: Prisma.SortOrderInput | Prisma.SortOrder;
    category?: Prisma.SortOrderInput | Prisma.SortOrder;
    city?: Prisma.SortOrderInput | Prisma.SortOrder;
    address?: Prisma.SortOrderInput | Prisma.SortOrder;
    logo_url?: Prisma.SortOrderInput | Prisma.SortOrder;
    lat?: Prisma.SortOrderInput | Prisma.SortOrder;
    lng?: Prisma.SortOrderInput | Prisma.SortOrder;
    is_verified?: Prisma.SortOrder;
    is_active?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    updated_at?: Prisma.SortOrder;
    _count?: Prisma.VendorCountOrderByAggregateInput;
    _avg?: Prisma.VendorAvgOrderByAggregateInput;
    _max?: Prisma.VendorMaxOrderByAggregateInput;
    _min?: Prisma.VendorMinOrderByAggregateInput;
    _sum?: Prisma.VendorSumOrderByAggregateInput;
};
export type VendorScalarWhereWithAggregatesInput = {
    AND?: Prisma.VendorScalarWhereWithAggregatesInput | Prisma.VendorScalarWhereWithAggregatesInput[];
    OR?: Prisma.VendorScalarWhereWithAggregatesInput[];
    NOT?: Prisma.VendorScalarWhereWithAggregatesInput | Prisma.VendorScalarWhereWithAggregatesInput[];
    id?: Prisma.StringWithAggregatesFilter<"Vendor"> | string;
    user_id?: Prisma.StringWithAggregatesFilter<"Vendor"> | string;
    shop_name?: Prisma.StringWithAggregatesFilter<"Vendor"> | string;
    description?: Prisma.StringNullableWithAggregatesFilter<"Vendor"> | string | null;
    category?: Prisma.StringNullableWithAggregatesFilter<"Vendor"> | string | null;
    city?: Prisma.StringNullableWithAggregatesFilter<"Vendor"> | string | null;
    address?: Prisma.StringNullableWithAggregatesFilter<"Vendor"> | string | null;
    logo_url?: Prisma.StringNullableWithAggregatesFilter<"Vendor"> | string | null;
    lat?: Prisma.FloatNullableWithAggregatesFilter<"Vendor"> | number | null;
    lng?: Prisma.FloatNullableWithAggregatesFilter<"Vendor"> | number | null;
    is_verified?: Prisma.BoolWithAggregatesFilter<"Vendor"> | boolean;
    is_active?: Prisma.BoolWithAggregatesFilter<"Vendor"> | boolean;
    created_at?: Prisma.DateTimeWithAggregatesFilter<"Vendor"> | Date | string;
    updated_at?: Prisma.DateTimeWithAggregatesFilter<"Vendor"> | Date | string;
};
export type VendorCreateInput = {
    id?: string;
    shop_name: string;
    description?: string | null;
    category?: string | null;
    city?: string | null;
    address?: string | null;
    logo_url?: string | null;
    lat?: number | null;
    lng?: number | null;
    is_verified?: boolean;
    is_active?: boolean;
    created_at?: Date | string;
    updated_at?: Date | string;
    user: Prisma.UserCreateNestedOneWithoutVendorInput;
    products?: Prisma.ProductCreateNestedManyWithoutVendorInput;
    orders?: Prisma.OrderCreateNestedManyWithoutVendorInput;
    reviews?: Prisma.ReviewCreateNestedManyWithoutVendorInput;
    savedBy?: Prisma.SavedVendorCreateNestedManyWithoutVendorInput;
};
export type VendorUncheckedCreateInput = {
    id?: string;
    user_id: string;
    shop_name: string;
    description?: string | null;
    category?: string | null;
    city?: string | null;
    address?: string | null;
    logo_url?: string | null;
    lat?: number | null;
    lng?: number | null;
    is_verified?: boolean;
    is_active?: boolean;
    created_at?: Date | string;
    updated_at?: Date | string;
    products?: Prisma.ProductUncheckedCreateNestedManyWithoutVendorInput;
    orders?: Prisma.OrderUncheckedCreateNestedManyWithoutVendorInput;
    reviews?: Prisma.ReviewUncheckedCreateNestedManyWithoutVendorInput;
    savedBy?: Prisma.SavedVendorUncheckedCreateNestedManyWithoutVendorInput;
};
export type VendorUpdateInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    shop_name?: Prisma.StringFieldUpdateOperationsInput | string;
    description?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    category?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    city?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    address?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    logo_url?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    lat?: Prisma.NullableFloatFieldUpdateOperationsInput | number | null;
    lng?: Prisma.NullableFloatFieldUpdateOperationsInput | number | null;
    is_verified?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    is_active?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    user?: Prisma.UserUpdateOneRequiredWithoutVendorNestedInput;
    products?: Prisma.ProductUpdateManyWithoutVendorNestedInput;
    orders?: Prisma.OrderUpdateManyWithoutVendorNestedInput;
    reviews?: Prisma.ReviewUpdateManyWithoutVendorNestedInput;
    savedBy?: Prisma.SavedVendorUpdateManyWithoutVendorNestedInput;
};
export type VendorUncheckedUpdateInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    user_id?: Prisma.StringFieldUpdateOperationsInput | string;
    shop_name?: Prisma.StringFieldUpdateOperationsInput | string;
    description?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    category?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    city?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    address?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    logo_url?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    lat?: Prisma.NullableFloatFieldUpdateOperationsInput | number | null;
    lng?: Prisma.NullableFloatFieldUpdateOperationsInput | number | null;
    is_verified?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    is_active?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    products?: Prisma.ProductUncheckedUpdateManyWithoutVendorNestedInput;
    orders?: Prisma.OrderUncheckedUpdateManyWithoutVendorNestedInput;
    reviews?: Prisma.ReviewUncheckedUpdateManyWithoutVendorNestedInput;
    savedBy?: Prisma.SavedVendorUncheckedUpdateManyWithoutVendorNestedInput;
};
export type VendorCreateManyInput = {
    id?: string;
    user_id: string;
    shop_name: string;
    description?: string | null;
    category?: string | null;
    city?: string | null;
    address?: string | null;
    logo_url?: string | null;
    lat?: number | null;
    lng?: number | null;
    is_verified?: boolean;
    is_active?: boolean;
    created_at?: Date | string;
    updated_at?: Date | string;
};
export type VendorUpdateManyMutationInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    shop_name?: Prisma.StringFieldUpdateOperationsInput | string;
    description?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    category?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    city?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    address?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    logo_url?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    lat?: Prisma.NullableFloatFieldUpdateOperationsInput | number | null;
    lng?: Prisma.NullableFloatFieldUpdateOperationsInput | number | null;
    is_verified?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    is_active?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type VendorUncheckedUpdateManyInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    user_id?: Prisma.StringFieldUpdateOperationsInput | string;
    shop_name?: Prisma.StringFieldUpdateOperationsInput | string;
    description?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    category?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    city?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    address?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    logo_url?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    lat?: Prisma.NullableFloatFieldUpdateOperationsInput | number | null;
    lng?: Prisma.NullableFloatFieldUpdateOperationsInput | number | null;
    is_verified?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    is_active?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type VendorNullableScalarRelationFilter = {
    is?: Prisma.VendorWhereInput | null;
    isNot?: Prisma.VendorWhereInput | null;
};
export type VendorCountOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    user_id?: Prisma.SortOrder;
    shop_name?: Prisma.SortOrder;
    description?: Prisma.SortOrder;
    category?: Prisma.SortOrder;
    city?: Prisma.SortOrder;
    address?: Prisma.SortOrder;
    logo_url?: Prisma.SortOrder;
    lat?: Prisma.SortOrder;
    lng?: Prisma.SortOrder;
    is_verified?: Prisma.SortOrder;
    is_active?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    updated_at?: Prisma.SortOrder;
};
export type VendorAvgOrderByAggregateInput = {
    lat?: Prisma.SortOrder;
    lng?: Prisma.SortOrder;
};
export type VendorMaxOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    user_id?: Prisma.SortOrder;
    shop_name?: Prisma.SortOrder;
    description?: Prisma.SortOrder;
    category?: Prisma.SortOrder;
    city?: Prisma.SortOrder;
    address?: Prisma.SortOrder;
    logo_url?: Prisma.SortOrder;
    lat?: Prisma.SortOrder;
    lng?: Prisma.SortOrder;
    is_verified?: Prisma.SortOrder;
    is_active?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    updated_at?: Prisma.SortOrder;
};
export type VendorMinOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    user_id?: Prisma.SortOrder;
    shop_name?: Prisma.SortOrder;
    description?: Prisma.SortOrder;
    category?: Prisma.SortOrder;
    city?: Prisma.SortOrder;
    address?: Prisma.SortOrder;
    logo_url?: Prisma.SortOrder;
    lat?: Prisma.SortOrder;
    lng?: Prisma.SortOrder;
    is_verified?: Prisma.SortOrder;
    is_active?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    updated_at?: Prisma.SortOrder;
};
export type VendorSumOrderByAggregateInput = {
    lat?: Prisma.SortOrder;
    lng?: Prisma.SortOrder;
};
export type VendorScalarRelationFilter = {
    is?: Prisma.VendorWhereInput;
    isNot?: Prisma.VendorWhereInput;
};
export type VendorCreateNestedOneWithoutUserInput = {
    create?: Prisma.XOR<Prisma.VendorCreateWithoutUserInput, Prisma.VendorUncheckedCreateWithoutUserInput>;
    connectOrCreate?: Prisma.VendorCreateOrConnectWithoutUserInput;
    connect?: Prisma.VendorWhereUniqueInput;
};
export type VendorUncheckedCreateNestedOneWithoutUserInput = {
    create?: Prisma.XOR<Prisma.VendorCreateWithoutUserInput, Prisma.VendorUncheckedCreateWithoutUserInput>;
    connectOrCreate?: Prisma.VendorCreateOrConnectWithoutUserInput;
    connect?: Prisma.VendorWhereUniqueInput;
};
export type VendorUpdateOneWithoutUserNestedInput = {
    create?: Prisma.XOR<Prisma.VendorCreateWithoutUserInput, Prisma.VendorUncheckedCreateWithoutUserInput>;
    connectOrCreate?: Prisma.VendorCreateOrConnectWithoutUserInput;
    upsert?: Prisma.VendorUpsertWithoutUserInput;
    disconnect?: Prisma.VendorWhereInput | boolean;
    delete?: Prisma.VendorWhereInput | boolean;
    connect?: Prisma.VendorWhereUniqueInput;
    update?: Prisma.XOR<Prisma.XOR<Prisma.VendorUpdateToOneWithWhereWithoutUserInput, Prisma.VendorUpdateWithoutUserInput>, Prisma.VendorUncheckedUpdateWithoutUserInput>;
};
export type VendorUncheckedUpdateOneWithoutUserNestedInput = {
    create?: Prisma.XOR<Prisma.VendorCreateWithoutUserInput, Prisma.VendorUncheckedCreateWithoutUserInput>;
    connectOrCreate?: Prisma.VendorCreateOrConnectWithoutUserInput;
    upsert?: Prisma.VendorUpsertWithoutUserInput;
    disconnect?: Prisma.VendorWhereInput | boolean;
    delete?: Prisma.VendorWhereInput | boolean;
    connect?: Prisma.VendorWhereUniqueInput;
    update?: Prisma.XOR<Prisma.XOR<Prisma.VendorUpdateToOneWithWhereWithoutUserInput, Prisma.VendorUpdateWithoutUserInput>, Prisma.VendorUncheckedUpdateWithoutUserInput>;
};
export type NullableFloatFieldUpdateOperationsInput = {
    set?: number | null;
    increment?: number;
    decrement?: number;
    multiply?: number;
    divide?: number;
};
export type VendorCreateNestedOneWithoutOrdersInput = {
    create?: Prisma.XOR<Prisma.VendorCreateWithoutOrdersInput, Prisma.VendorUncheckedCreateWithoutOrdersInput>;
    connectOrCreate?: Prisma.VendorCreateOrConnectWithoutOrdersInput;
    connect?: Prisma.VendorWhereUniqueInput;
};
export type VendorUpdateOneRequiredWithoutOrdersNestedInput = {
    create?: Prisma.XOR<Prisma.VendorCreateWithoutOrdersInput, Prisma.VendorUncheckedCreateWithoutOrdersInput>;
    connectOrCreate?: Prisma.VendorCreateOrConnectWithoutOrdersInput;
    upsert?: Prisma.VendorUpsertWithoutOrdersInput;
    connect?: Prisma.VendorWhereUniqueInput;
    update?: Prisma.XOR<Prisma.XOR<Prisma.VendorUpdateToOneWithWhereWithoutOrdersInput, Prisma.VendorUpdateWithoutOrdersInput>, Prisma.VendorUncheckedUpdateWithoutOrdersInput>;
};
export type VendorCreateNestedOneWithoutReviewsInput = {
    create?: Prisma.XOR<Prisma.VendorCreateWithoutReviewsInput, Prisma.VendorUncheckedCreateWithoutReviewsInput>;
    connectOrCreate?: Prisma.VendorCreateOrConnectWithoutReviewsInput;
    connect?: Prisma.VendorWhereUniqueInput;
};
export type VendorUpdateOneRequiredWithoutReviewsNestedInput = {
    create?: Prisma.XOR<Prisma.VendorCreateWithoutReviewsInput, Prisma.VendorUncheckedCreateWithoutReviewsInput>;
    connectOrCreate?: Prisma.VendorCreateOrConnectWithoutReviewsInput;
    upsert?: Prisma.VendorUpsertWithoutReviewsInput;
    connect?: Prisma.VendorWhereUniqueInput;
    update?: Prisma.XOR<Prisma.XOR<Prisma.VendorUpdateToOneWithWhereWithoutReviewsInput, Prisma.VendorUpdateWithoutReviewsInput>, Prisma.VendorUncheckedUpdateWithoutReviewsInput>;
};
export type VendorCreateNestedOneWithoutSavedByInput = {
    create?: Prisma.XOR<Prisma.VendorCreateWithoutSavedByInput, Prisma.VendorUncheckedCreateWithoutSavedByInput>;
    connectOrCreate?: Prisma.VendorCreateOrConnectWithoutSavedByInput;
    connect?: Prisma.VendorWhereUniqueInput;
};
export type VendorUpdateOneRequiredWithoutSavedByNestedInput = {
    create?: Prisma.XOR<Prisma.VendorCreateWithoutSavedByInput, Prisma.VendorUncheckedCreateWithoutSavedByInput>;
    connectOrCreate?: Prisma.VendorCreateOrConnectWithoutSavedByInput;
    upsert?: Prisma.VendorUpsertWithoutSavedByInput;
    connect?: Prisma.VendorWhereUniqueInput;
    update?: Prisma.XOR<Prisma.XOR<Prisma.VendorUpdateToOneWithWhereWithoutSavedByInput, Prisma.VendorUpdateWithoutSavedByInput>, Prisma.VendorUncheckedUpdateWithoutSavedByInput>;
};
export type VendorCreateNestedOneWithoutProductsInput = {
    create?: Prisma.XOR<Prisma.VendorCreateWithoutProductsInput, Prisma.VendorUncheckedCreateWithoutProductsInput>;
    connectOrCreate?: Prisma.VendorCreateOrConnectWithoutProductsInput;
    connect?: Prisma.VendorWhereUniqueInput;
};
export type VendorUpdateOneRequiredWithoutProductsNestedInput = {
    create?: Prisma.XOR<Prisma.VendorCreateWithoutProductsInput, Prisma.VendorUncheckedCreateWithoutProductsInput>;
    connectOrCreate?: Prisma.VendorCreateOrConnectWithoutProductsInput;
    upsert?: Prisma.VendorUpsertWithoutProductsInput;
    connect?: Prisma.VendorWhereUniqueInput;
    update?: Prisma.XOR<Prisma.XOR<Prisma.VendorUpdateToOneWithWhereWithoutProductsInput, Prisma.VendorUpdateWithoutProductsInput>, Prisma.VendorUncheckedUpdateWithoutProductsInput>;
};
export type VendorCreateWithoutUserInput = {
    id?: string;
    shop_name: string;
    description?: string | null;
    category?: string | null;
    city?: string | null;
    address?: string | null;
    logo_url?: string | null;
    lat?: number | null;
    lng?: number | null;
    is_verified?: boolean;
    is_active?: boolean;
    created_at?: Date | string;
    updated_at?: Date | string;
    products?: Prisma.ProductCreateNestedManyWithoutVendorInput;
    orders?: Prisma.OrderCreateNestedManyWithoutVendorInput;
    reviews?: Prisma.ReviewCreateNestedManyWithoutVendorInput;
    savedBy?: Prisma.SavedVendorCreateNestedManyWithoutVendorInput;
};
export type VendorUncheckedCreateWithoutUserInput = {
    id?: string;
    shop_name: string;
    description?: string | null;
    category?: string | null;
    city?: string | null;
    address?: string | null;
    logo_url?: string | null;
    lat?: number | null;
    lng?: number | null;
    is_verified?: boolean;
    is_active?: boolean;
    created_at?: Date | string;
    updated_at?: Date | string;
    products?: Prisma.ProductUncheckedCreateNestedManyWithoutVendorInput;
    orders?: Prisma.OrderUncheckedCreateNestedManyWithoutVendorInput;
    reviews?: Prisma.ReviewUncheckedCreateNestedManyWithoutVendorInput;
    savedBy?: Prisma.SavedVendorUncheckedCreateNestedManyWithoutVendorInput;
};
export type VendorCreateOrConnectWithoutUserInput = {
    where: Prisma.VendorWhereUniqueInput;
    create: Prisma.XOR<Prisma.VendorCreateWithoutUserInput, Prisma.VendorUncheckedCreateWithoutUserInput>;
};
export type VendorUpsertWithoutUserInput = {
    update: Prisma.XOR<Prisma.VendorUpdateWithoutUserInput, Prisma.VendorUncheckedUpdateWithoutUserInput>;
    create: Prisma.XOR<Prisma.VendorCreateWithoutUserInput, Prisma.VendorUncheckedCreateWithoutUserInput>;
    where?: Prisma.VendorWhereInput;
};
export type VendorUpdateToOneWithWhereWithoutUserInput = {
    where?: Prisma.VendorWhereInput;
    data: Prisma.XOR<Prisma.VendorUpdateWithoutUserInput, Prisma.VendorUncheckedUpdateWithoutUserInput>;
};
export type VendorUpdateWithoutUserInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    shop_name?: Prisma.StringFieldUpdateOperationsInput | string;
    description?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    category?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    city?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    address?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    logo_url?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    lat?: Prisma.NullableFloatFieldUpdateOperationsInput | number | null;
    lng?: Prisma.NullableFloatFieldUpdateOperationsInput | number | null;
    is_verified?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    is_active?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    products?: Prisma.ProductUpdateManyWithoutVendorNestedInput;
    orders?: Prisma.OrderUpdateManyWithoutVendorNestedInput;
    reviews?: Prisma.ReviewUpdateManyWithoutVendorNestedInput;
    savedBy?: Prisma.SavedVendorUpdateManyWithoutVendorNestedInput;
};
export type VendorUncheckedUpdateWithoutUserInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    shop_name?: Prisma.StringFieldUpdateOperationsInput | string;
    description?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    category?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    city?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    address?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    logo_url?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    lat?: Prisma.NullableFloatFieldUpdateOperationsInput | number | null;
    lng?: Prisma.NullableFloatFieldUpdateOperationsInput | number | null;
    is_verified?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    is_active?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    products?: Prisma.ProductUncheckedUpdateManyWithoutVendorNestedInput;
    orders?: Prisma.OrderUncheckedUpdateManyWithoutVendorNestedInput;
    reviews?: Prisma.ReviewUncheckedUpdateManyWithoutVendorNestedInput;
    savedBy?: Prisma.SavedVendorUncheckedUpdateManyWithoutVendorNestedInput;
};
export type VendorCreateWithoutOrdersInput = {
    id?: string;
    shop_name: string;
    description?: string | null;
    category?: string | null;
    city?: string | null;
    address?: string | null;
    logo_url?: string | null;
    lat?: number | null;
    lng?: number | null;
    is_verified?: boolean;
    is_active?: boolean;
    created_at?: Date | string;
    updated_at?: Date | string;
    user: Prisma.UserCreateNestedOneWithoutVendorInput;
    products?: Prisma.ProductCreateNestedManyWithoutVendorInput;
    reviews?: Prisma.ReviewCreateNestedManyWithoutVendorInput;
    savedBy?: Prisma.SavedVendorCreateNestedManyWithoutVendorInput;
};
export type VendorUncheckedCreateWithoutOrdersInput = {
    id?: string;
    user_id: string;
    shop_name: string;
    description?: string | null;
    category?: string | null;
    city?: string | null;
    address?: string | null;
    logo_url?: string | null;
    lat?: number | null;
    lng?: number | null;
    is_verified?: boolean;
    is_active?: boolean;
    created_at?: Date | string;
    updated_at?: Date | string;
    products?: Prisma.ProductUncheckedCreateNestedManyWithoutVendorInput;
    reviews?: Prisma.ReviewUncheckedCreateNestedManyWithoutVendorInput;
    savedBy?: Prisma.SavedVendorUncheckedCreateNestedManyWithoutVendorInput;
};
export type VendorCreateOrConnectWithoutOrdersInput = {
    where: Prisma.VendorWhereUniqueInput;
    create: Prisma.XOR<Prisma.VendorCreateWithoutOrdersInput, Prisma.VendorUncheckedCreateWithoutOrdersInput>;
};
export type VendorUpsertWithoutOrdersInput = {
    update: Prisma.XOR<Prisma.VendorUpdateWithoutOrdersInput, Prisma.VendorUncheckedUpdateWithoutOrdersInput>;
    create: Prisma.XOR<Prisma.VendorCreateWithoutOrdersInput, Prisma.VendorUncheckedCreateWithoutOrdersInput>;
    where?: Prisma.VendorWhereInput;
};
export type VendorUpdateToOneWithWhereWithoutOrdersInput = {
    where?: Prisma.VendorWhereInput;
    data: Prisma.XOR<Prisma.VendorUpdateWithoutOrdersInput, Prisma.VendorUncheckedUpdateWithoutOrdersInput>;
};
export type VendorUpdateWithoutOrdersInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    shop_name?: Prisma.StringFieldUpdateOperationsInput | string;
    description?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    category?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    city?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    address?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    logo_url?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    lat?: Prisma.NullableFloatFieldUpdateOperationsInput | number | null;
    lng?: Prisma.NullableFloatFieldUpdateOperationsInput | number | null;
    is_verified?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    is_active?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    user?: Prisma.UserUpdateOneRequiredWithoutVendorNestedInput;
    products?: Prisma.ProductUpdateManyWithoutVendorNestedInput;
    reviews?: Prisma.ReviewUpdateManyWithoutVendorNestedInput;
    savedBy?: Prisma.SavedVendorUpdateManyWithoutVendorNestedInput;
};
export type VendorUncheckedUpdateWithoutOrdersInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    user_id?: Prisma.StringFieldUpdateOperationsInput | string;
    shop_name?: Prisma.StringFieldUpdateOperationsInput | string;
    description?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    category?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    city?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    address?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    logo_url?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    lat?: Prisma.NullableFloatFieldUpdateOperationsInput | number | null;
    lng?: Prisma.NullableFloatFieldUpdateOperationsInput | number | null;
    is_verified?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    is_active?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    products?: Prisma.ProductUncheckedUpdateManyWithoutVendorNestedInput;
    reviews?: Prisma.ReviewUncheckedUpdateManyWithoutVendorNestedInput;
    savedBy?: Prisma.SavedVendorUncheckedUpdateManyWithoutVendorNestedInput;
};
export type VendorCreateWithoutReviewsInput = {
    id?: string;
    shop_name: string;
    description?: string | null;
    category?: string | null;
    city?: string | null;
    address?: string | null;
    logo_url?: string | null;
    lat?: number | null;
    lng?: number | null;
    is_verified?: boolean;
    is_active?: boolean;
    created_at?: Date | string;
    updated_at?: Date | string;
    user: Prisma.UserCreateNestedOneWithoutVendorInput;
    products?: Prisma.ProductCreateNestedManyWithoutVendorInput;
    orders?: Prisma.OrderCreateNestedManyWithoutVendorInput;
    savedBy?: Prisma.SavedVendorCreateNestedManyWithoutVendorInput;
};
export type VendorUncheckedCreateWithoutReviewsInput = {
    id?: string;
    user_id: string;
    shop_name: string;
    description?: string | null;
    category?: string | null;
    city?: string | null;
    address?: string | null;
    logo_url?: string | null;
    lat?: number | null;
    lng?: number | null;
    is_verified?: boolean;
    is_active?: boolean;
    created_at?: Date | string;
    updated_at?: Date | string;
    products?: Prisma.ProductUncheckedCreateNestedManyWithoutVendorInput;
    orders?: Prisma.OrderUncheckedCreateNestedManyWithoutVendorInput;
    savedBy?: Prisma.SavedVendorUncheckedCreateNestedManyWithoutVendorInput;
};
export type VendorCreateOrConnectWithoutReviewsInput = {
    where: Prisma.VendorWhereUniqueInput;
    create: Prisma.XOR<Prisma.VendorCreateWithoutReviewsInput, Prisma.VendorUncheckedCreateWithoutReviewsInput>;
};
export type VendorUpsertWithoutReviewsInput = {
    update: Prisma.XOR<Prisma.VendorUpdateWithoutReviewsInput, Prisma.VendorUncheckedUpdateWithoutReviewsInput>;
    create: Prisma.XOR<Prisma.VendorCreateWithoutReviewsInput, Prisma.VendorUncheckedCreateWithoutReviewsInput>;
    where?: Prisma.VendorWhereInput;
};
export type VendorUpdateToOneWithWhereWithoutReviewsInput = {
    where?: Prisma.VendorWhereInput;
    data: Prisma.XOR<Prisma.VendorUpdateWithoutReviewsInput, Prisma.VendorUncheckedUpdateWithoutReviewsInput>;
};
export type VendorUpdateWithoutReviewsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    shop_name?: Prisma.StringFieldUpdateOperationsInput | string;
    description?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    category?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    city?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    address?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    logo_url?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    lat?: Prisma.NullableFloatFieldUpdateOperationsInput | number | null;
    lng?: Prisma.NullableFloatFieldUpdateOperationsInput | number | null;
    is_verified?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    is_active?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    user?: Prisma.UserUpdateOneRequiredWithoutVendorNestedInput;
    products?: Prisma.ProductUpdateManyWithoutVendorNestedInput;
    orders?: Prisma.OrderUpdateManyWithoutVendorNestedInput;
    savedBy?: Prisma.SavedVendorUpdateManyWithoutVendorNestedInput;
};
export type VendorUncheckedUpdateWithoutReviewsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    user_id?: Prisma.StringFieldUpdateOperationsInput | string;
    shop_name?: Prisma.StringFieldUpdateOperationsInput | string;
    description?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    category?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    city?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    address?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    logo_url?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    lat?: Prisma.NullableFloatFieldUpdateOperationsInput | number | null;
    lng?: Prisma.NullableFloatFieldUpdateOperationsInput | number | null;
    is_verified?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    is_active?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    products?: Prisma.ProductUncheckedUpdateManyWithoutVendorNestedInput;
    orders?: Prisma.OrderUncheckedUpdateManyWithoutVendorNestedInput;
    savedBy?: Prisma.SavedVendorUncheckedUpdateManyWithoutVendorNestedInput;
};
export type VendorCreateWithoutSavedByInput = {
    id?: string;
    shop_name: string;
    description?: string | null;
    category?: string | null;
    city?: string | null;
    address?: string | null;
    logo_url?: string | null;
    lat?: number | null;
    lng?: number | null;
    is_verified?: boolean;
    is_active?: boolean;
    created_at?: Date | string;
    updated_at?: Date | string;
    user: Prisma.UserCreateNestedOneWithoutVendorInput;
    products?: Prisma.ProductCreateNestedManyWithoutVendorInput;
    orders?: Prisma.OrderCreateNestedManyWithoutVendorInput;
    reviews?: Prisma.ReviewCreateNestedManyWithoutVendorInput;
};
export type VendorUncheckedCreateWithoutSavedByInput = {
    id?: string;
    user_id: string;
    shop_name: string;
    description?: string | null;
    category?: string | null;
    city?: string | null;
    address?: string | null;
    logo_url?: string | null;
    lat?: number | null;
    lng?: number | null;
    is_verified?: boolean;
    is_active?: boolean;
    created_at?: Date | string;
    updated_at?: Date | string;
    products?: Prisma.ProductUncheckedCreateNestedManyWithoutVendorInput;
    orders?: Prisma.OrderUncheckedCreateNestedManyWithoutVendorInput;
    reviews?: Prisma.ReviewUncheckedCreateNestedManyWithoutVendorInput;
};
export type VendorCreateOrConnectWithoutSavedByInput = {
    where: Prisma.VendorWhereUniqueInput;
    create: Prisma.XOR<Prisma.VendorCreateWithoutSavedByInput, Prisma.VendorUncheckedCreateWithoutSavedByInput>;
};
export type VendorUpsertWithoutSavedByInput = {
    update: Prisma.XOR<Prisma.VendorUpdateWithoutSavedByInput, Prisma.VendorUncheckedUpdateWithoutSavedByInput>;
    create: Prisma.XOR<Prisma.VendorCreateWithoutSavedByInput, Prisma.VendorUncheckedCreateWithoutSavedByInput>;
    where?: Prisma.VendorWhereInput;
};
export type VendorUpdateToOneWithWhereWithoutSavedByInput = {
    where?: Prisma.VendorWhereInput;
    data: Prisma.XOR<Prisma.VendorUpdateWithoutSavedByInput, Prisma.VendorUncheckedUpdateWithoutSavedByInput>;
};
export type VendorUpdateWithoutSavedByInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    shop_name?: Prisma.StringFieldUpdateOperationsInput | string;
    description?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    category?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    city?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    address?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    logo_url?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    lat?: Prisma.NullableFloatFieldUpdateOperationsInput | number | null;
    lng?: Prisma.NullableFloatFieldUpdateOperationsInput | number | null;
    is_verified?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    is_active?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    user?: Prisma.UserUpdateOneRequiredWithoutVendorNestedInput;
    products?: Prisma.ProductUpdateManyWithoutVendorNestedInput;
    orders?: Prisma.OrderUpdateManyWithoutVendorNestedInput;
    reviews?: Prisma.ReviewUpdateManyWithoutVendorNestedInput;
};
export type VendorUncheckedUpdateWithoutSavedByInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    user_id?: Prisma.StringFieldUpdateOperationsInput | string;
    shop_name?: Prisma.StringFieldUpdateOperationsInput | string;
    description?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    category?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    city?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    address?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    logo_url?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    lat?: Prisma.NullableFloatFieldUpdateOperationsInput | number | null;
    lng?: Prisma.NullableFloatFieldUpdateOperationsInput | number | null;
    is_verified?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    is_active?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    products?: Prisma.ProductUncheckedUpdateManyWithoutVendorNestedInput;
    orders?: Prisma.OrderUncheckedUpdateManyWithoutVendorNestedInput;
    reviews?: Prisma.ReviewUncheckedUpdateManyWithoutVendorNestedInput;
};
export type VendorCreateWithoutProductsInput = {
    id?: string;
    shop_name: string;
    description?: string | null;
    category?: string | null;
    city?: string | null;
    address?: string | null;
    logo_url?: string | null;
    lat?: number | null;
    lng?: number | null;
    is_verified?: boolean;
    is_active?: boolean;
    created_at?: Date | string;
    updated_at?: Date | string;
    user: Prisma.UserCreateNestedOneWithoutVendorInput;
    orders?: Prisma.OrderCreateNestedManyWithoutVendorInput;
    reviews?: Prisma.ReviewCreateNestedManyWithoutVendorInput;
    savedBy?: Prisma.SavedVendorCreateNestedManyWithoutVendorInput;
};
export type VendorUncheckedCreateWithoutProductsInput = {
    id?: string;
    user_id: string;
    shop_name: string;
    description?: string | null;
    category?: string | null;
    city?: string | null;
    address?: string | null;
    logo_url?: string | null;
    lat?: number | null;
    lng?: number | null;
    is_verified?: boolean;
    is_active?: boolean;
    created_at?: Date | string;
    updated_at?: Date | string;
    orders?: Prisma.OrderUncheckedCreateNestedManyWithoutVendorInput;
    reviews?: Prisma.ReviewUncheckedCreateNestedManyWithoutVendorInput;
    savedBy?: Prisma.SavedVendorUncheckedCreateNestedManyWithoutVendorInput;
};
export type VendorCreateOrConnectWithoutProductsInput = {
    where: Prisma.VendorWhereUniqueInput;
    create: Prisma.XOR<Prisma.VendorCreateWithoutProductsInput, Prisma.VendorUncheckedCreateWithoutProductsInput>;
};
export type VendorUpsertWithoutProductsInput = {
    update: Prisma.XOR<Prisma.VendorUpdateWithoutProductsInput, Prisma.VendorUncheckedUpdateWithoutProductsInput>;
    create: Prisma.XOR<Prisma.VendorCreateWithoutProductsInput, Prisma.VendorUncheckedCreateWithoutProductsInput>;
    where?: Prisma.VendorWhereInput;
};
export type VendorUpdateToOneWithWhereWithoutProductsInput = {
    where?: Prisma.VendorWhereInput;
    data: Prisma.XOR<Prisma.VendorUpdateWithoutProductsInput, Prisma.VendorUncheckedUpdateWithoutProductsInput>;
};
export type VendorUpdateWithoutProductsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    shop_name?: Prisma.StringFieldUpdateOperationsInput | string;
    description?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    category?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    city?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    address?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    logo_url?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    lat?: Prisma.NullableFloatFieldUpdateOperationsInput | number | null;
    lng?: Prisma.NullableFloatFieldUpdateOperationsInput | number | null;
    is_verified?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    is_active?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    user?: Prisma.UserUpdateOneRequiredWithoutVendorNestedInput;
    orders?: Prisma.OrderUpdateManyWithoutVendorNestedInput;
    reviews?: Prisma.ReviewUpdateManyWithoutVendorNestedInput;
    savedBy?: Prisma.SavedVendorUpdateManyWithoutVendorNestedInput;
};
export type VendorUncheckedUpdateWithoutProductsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    user_id?: Prisma.StringFieldUpdateOperationsInput | string;
    shop_name?: Prisma.StringFieldUpdateOperationsInput | string;
    description?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    category?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    city?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    address?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    logo_url?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    lat?: Prisma.NullableFloatFieldUpdateOperationsInput | number | null;
    lng?: Prisma.NullableFloatFieldUpdateOperationsInput | number | null;
    is_verified?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    is_active?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    orders?: Prisma.OrderUncheckedUpdateManyWithoutVendorNestedInput;
    reviews?: Prisma.ReviewUncheckedUpdateManyWithoutVendorNestedInput;
    savedBy?: Prisma.SavedVendorUncheckedUpdateManyWithoutVendorNestedInput;
};
/**
 * Count Type VendorCountOutputType
 */
export type VendorCountOutputType = {
    products: number;
    orders: number;
    reviews: number;
    savedBy: number;
};
export type VendorCountOutputTypeSelect<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    products?: boolean | VendorCountOutputTypeCountProductsArgs;
    orders?: boolean | VendorCountOutputTypeCountOrdersArgs;
    reviews?: boolean | VendorCountOutputTypeCountReviewsArgs;
    savedBy?: boolean | VendorCountOutputTypeCountSavedByArgs;
};
/**
 * VendorCountOutputType without action
 */
export type VendorCountOutputTypeDefaultArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the VendorCountOutputType
     */
    select?: Prisma.VendorCountOutputTypeSelect<ExtArgs> | null;
};
/**
 * VendorCountOutputType without action
 */
export type VendorCountOutputTypeCountProductsArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.ProductWhereInput;
};
/**
 * VendorCountOutputType without action
 */
export type VendorCountOutputTypeCountOrdersArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.OrderWhereInput;
};
/**
 * VendorCountOutputType without action
 */
export type VendorCountOutputTypeCountReviewsArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.ReviewWhereInput;
};
/**
 * VendorCountOutputType without action
 */
export type VendorCountOutputTypeCountSavedByArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.SavedVendorWhereInput;
};
export type VendorSelect<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetSelect<{
    id?: boolean;
    user_id?: boolean;
    shop_name?: boolean;
    description?: boolean;
    category?: boolean;
    city?: boolean;
    address?: boolean;
    logo_url?: boolean;
    lat?: boolean;
    lng?: boolean;
    is_verified?: boolean;
    is_active?: boolean;
    created_at?: boolean;
    updated_at?: boolean;
    user?: boolean | Prisma.UserDefaultArgs<ExtArgs>;
    products?: boolean | Prisma.Vendor$productsArgs<ExtArgs>;
    orders?: boolean | Prisma.Vendor$ordersArgs<ExtArgs>;
    reviews?: boolean | Prisma.Vendor$reviewsArgs<ExtArgs>;
    savedBy?: boolean | Prisma.Vendor$savedByArgs<ExtArgs>;
    _count?: boolean | Prisma.VendorCountOutputTypeDefaultArgs<ExtArgs>;
}, ExtArgs["result"]["vendor"]>;
export type VendorSelectCreateManyAndReturn<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetSelect<{
    id?: boolean;
    user_id?: boolean;
    shop_name?: boolean;
    description?: boolean;
    category?: boolean;
    city?: boolean;
    address?: boolean;
    logo_url?: boolean;
    lat?: boolean;
    lng?: boolean;
    is_verified?: boolean;
    is_active?: boolean;
    created_at?: boolean;
    updated_at?: boolean;
    user?: boolean | Prisma.UserDefaultArgs<ExtArgs>;
}, ExtArgs["result"]["vendor"]>;
export type VendorSelectUpdateManyAndReturn<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetSelect<{
    id?: boolean;
    user_id?: boolean;
    shop_name?: boolean;
    description?: boolean;
    category?: boolean;
    city?: boolean;
    address?: boolean;
    logo_url?: boolean;
    lat?: boolean;
    lng?: boolean;
    is_verified?: boolean;
    is_active?: boolean;
    created_at?: boolean;
    updated_at?: boolean;
    user?: boolean | Prisma.UserDefaultArgs<ExtArgs>;
}, ExtArgs["result"]["vendor"]>;
export type VendorSelectScalar = {
    id?: boolean;
    user_id?: boolean;
    shop_name?: boolean;
    description?: boolean;
    category?: boolean;
    city?: boolean;
    address?: boolean;
    logo_url?: boolean;
    lat?: boolean;
    lng?: boolean;
    is_verified?: boolean;
    is_active?: boolean;
    created_at?: boolean;
    updated_at?: boolean;
};
export type VendorOmit<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetOmit<"id" | "user_id" | "shop_name" | "description" | "category" | "city" | "address" | "logo_url" | "lat" | "lng" | "is_verified" | "is_active" | "created_at" | "updated_at", ExtArgs["result"]["vendor"]>;
export type VendorInclude<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    user?: boolean | Prisma.UserDefaultArgs<ExtArgs>;
    products?: boolean | Prisma.Vendor$productsArgs<ExtArgs>;
    orders?: boolean | Prisma.Vendor$ordersArgs<ExtArgs>;
    reviews?: boolean | Prisma.Vendor$reviewsArgs<ExtArgs>;
    savedBy?: boolean | Prisma.Vendor$savedByArgs<ExtArgs>;
    _count?: boolean | Prisma.VendorCountOutputTypeDefaultArgs<ExtArgs>;
};
export type VendorIncludeCreateManyAndReturn<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    user?: boolean | Prisma.UserDefaultArgs<ExtArgs>;
};
export type VendorIncludeUpdateManyAndReturn<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    user?: boolean | Prisma.UserDefaultArgs<ExtArgs>;
};
export type $VendorPayload<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    name: "Vendor";
    objects: {
        user: Prisma.$UserPayload<ExtArgs>;
        products: Prisma.$ProductPayload<ExtArgs>[];
        orders: Prisma.$OrderPayload<ExtArgs>[];
        reviews: Prisma.$ReviewPayload<ExtArgs>[];
        savedBy: Prisma.$SavedVendorPayload<ExtArgs>[];
    };
    scalars: runtime.Types.Extensions.GetPayloadResult<{
        id: string;
        user_id: string;
        shop_name: string;
        description: string | null;
        category: string | null;
        city: string | null;
        address: string | null;
        logo_url: string | null;
        lat: number | null;
        lng: number | null;
        is_verified: boolean;
        is_active: boolean;
        created_at: Date;
        updated_at: Date;
    }, ExtArgs["result"]["vendor"]>;
    composites: {};
};
export type VendorGetPayload<S extends boolean | null | undefined | VendorDefaultArgs> = runtime.Types.Result.GetResult<Prisma.$VendorPayload, S>;
export type VendorCountArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = Omit<VendorFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
    select?: VendorCountAggregateInputType | true;
};
export interface VendorDelegate<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: {
        types: Prisma.TypeMap<ExtArgs>['model']['Vendor'];
        meta: {
            name: 'Vendor';
        };
    };
    /**
     * Find zero or one Vendor that matches the filter.
     * @param {VendorFindUniqueArgs} args - Arguments to find a Vendor
     * @example
     * // Get one Vendor
     * const vendor = await prisma.vendor.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends VendorFindUniqueArgs>(args: Prisma.SelectSubset<T, VendorFindUniqueArgs<ExtArgs>>): Prisma.Prisma__VendorClient<runtime.Types.Result.GetResult<Prisma.$VendorPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    /**
     * Find one Vendor that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {VendorFindUniqueOrThrowArgs} args - Arguments to find a Vendor
     * @example
     * // Get one Vendor
     * const vendor = await prisma.vendor.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends VendorFindUniqueOrThrowArgs>(args: Prisma.SelectSubset<T, VendorFindUniqueOrThrowArgs<ExtArgs>>): Prisma.Prisma__VendorClient<runtime.Types.Result.GetResult<Prisma.$VendorPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    /**
     * Find the first Vendor that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {VendorFindFirstArgs} args - Arguments to find a Vendor
     * @example
     * // Get one Vendor
     * const vendor = await prisma.vendor.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends VendorFindFirstArgs>(args?: Prisma.SelectSubset<T, VendorFindFirstArgs<ExtArgs>>): Prisma.Prisma__VendorClient<runtime.Types.Result.GetResult<Prisma.$VendorPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    /**
     * Find the first Vendor that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {VendorFindFirstOrThrowArgs} args - Arguments to find a Vendor
     * @example
     * // Get one Vendor
     * const vendor = await prisma.vendor.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends VendorFindFirstOrThrowArgs>(args?: Prisma.SelectSubset<T, VendorFindFirstOrThrowArgs<ExtArgs>>): Prisma.Prisma__VendorClient<runtime.Types.Result.GetResult<Prisma.$VendorPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    /**
     * Find zero or more Vendors that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {VendorFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Vendors
     * const vendors = await prisma.vendor.findMany()
     *
     * // Get first 10 Vendors
     * const vendors = await prisma.vendor.findMany({ take: 10 })
     *
     * // Only select the `id`
     * const vendorWithIdOnly = await prisma.vendor.findMany({ select: { id: true } })
     *
     */
    findMany<T extends VendorFindManyArgs>(args?: Prisma.SelectSubset<T, VendorFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$VendorPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>;
    /**
     * Create a Vendor.
     * @param {VendorCreateArgs} args - Arguments to create a Vendor.
     * @example
     * // Create one Vendor
     * const Vendor = await prisma.vendor.create({
     *   data: {
     *     // ... data to create a Vendor
     *   }
     * })
     *
     */
    create<T extends VendorCreateArgs>(args: Prisma.SelectSubset<T, VendorCreateArgs<ExtArgs>>): Prisma.Prisma__VendorClient<runtime.Types.Result.GetResult<Prisma.$VendorPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    /**
     * Create many Vendors.
     * @param {VendorCreateManyArgs} args - Arguments to create many Vendors.
     * @example
     * // Create many Vendors
     * const vendor = await prisma.vendor.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     */
    createMany<T extends VendorCreateManyArgs>(args?: Prisma.SelectSubset<T, VendorCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    /**
     * Create many Vendors and returns the data saved in the database.
     * @param {VendorCreateManyAndReturnArgs} args - Arguments to create many Vendors.
     * @example
     * // Create many Vendors
     * const vendor = await prisma.vendor.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Create many Vendors and only return the `id`
     * const vendorWithIdOnly = await prisma.vendor.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     *
     */
    createManyAndReturn<T extends VendorCreateManyAndReturnArgs>(args?: Prisma.SelectSubset<T, VendorCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$VendorPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>;
    /**
     * Delete a Vendor.
     * @param {VendorDeleteArgs} args - Arguments to delete one Vendor.
     * @example
     * // Delete one Vendor
     * const Vendor = await prisma.vendor.delete({
     *   where: {
     *     // ... filter to delete one Vendor
     *   }
     * })
     *
     */
    delete<T extends VendorDeleteArgs>(args: Prisma.SelectSubset<T, VendorDeleteArgs<ExtArgs>>): Prisma.Prisma__VendorClient<runtime.Types.Result.GetResult<Prisma.$VendorPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    /**
     * Update one Vendor.
     * @param {VendorUpdateArgs} args - Arguments to update one Vendor.
     * @example
     * // Update one Vendor
     * const vendor = await prisma.vendor.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    update<T extends VendorUpdateArgs>(args: Prisma.SelectSubset<T, VendorUpdateArgs<ExtArgs>>): Prisma.Prisma__VendorClient<runtime.Types.Result.GetResult<Prisma.$VendorPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    /**
     * Delete zero or more Vendors.
     * @param {VendorDeleteManyArgs} args - Arguments to filter Vendors to delete.
     * @example
     * // Delete a few Vendors
     * const { count } = await prisma.vendor.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     *
     */
    deleteMany<T extends VendorDeleteManyArgs>(args?: Prisma.SelectSubset<T, VendorDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    /**
     * Update zero or more Vendors.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {VendorUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Vendors
     * const vendor = await prisma.vendor.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    updateMany<T extends VendorUpdateManyArgs>(args: Prisma.SelectSubset<T, VendorUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    /**
     * Update zero or more Vendors and returns the data updated in the database.
     * @param {VendorUpdateManyAndReturnArgs} args - Arguments to update many Vendors.
     * @example
     * // Update many Vendors
     * const vendor = await prisma.vendor.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Update zero or more Vendors and only return the `id`
     * const vendorWithIdOnly = await prisma.vendor.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     *
     */
    updateManyAndReturn<T extends VendorUpdateManyAndReturnArgs>(args: Prisma.SelectSubset<T, VendorUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$VendorPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>;
    /**
     * Create or update one Vendor.
     * @param {VendorUpsertArgs} args - Arguments to update or create a Vendor.
     * @example
     * // Update or create a Vendor
     * const vendor = await prisma.vendor.upsert({
     *   create: {
     *     // ... data to create a Vendor
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Vendor we want to update
     *   }
     * })
     */
    upsert<T extends VendorUpsertArgs>(args: Prisma.SelectSubset<T, VendorUpsertArgs<ExtArgs>>): Prisma.Prisma__VendorClient<runtime.Types.Result.GetResult<Prisma.$VendorPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    /**
     * Count the number of Vendors.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {VendorCountArgs} args - Arguments to filter Vendors to count.
     * @example
     * // Count the number of Vendors
     * const count = await prisma.vendor.count({
     *   where: {
     *     // ... the filter for the Vendors we want to count
     *   }
     * })
    **/
    count<T extends VendorCountArgs>(args?: Prisma.Subset<T, VendorCountArgs>): Prisma.PrismaPromise<T extends runtime.Types.Utils.Record<'select', any> ? T['select'] extends true ? number : Prisma.GetScalarType<T['select'], VendorCountAggregateOutputType> : number>;
    /**
     * Allows you to perform aggregations operations on a Vendor.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {VendorAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends VendorAggregateArgs>(args: Prisma.Subset<T, VendorAggregateArgs>): Prisma.PrismaPromise<GetVendorAggregateType<T>>;
    /**
     * Group by Vendor.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {VendorGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     *
    **/
    groupBy<T extends VendorGroupByArgs, HasSelectOrTake extends Prisma.Or<Prisma.Extends<'skip', Prisma.Keys<T>>, Prisma.Extends<'take', Prisma.Keys<T>>>, OrderByArg extends Prisma.True extends HasSelectOrTake ? {
        orderBy: VendorGroupByArgs['orderBy'];
    } : {
        orderBy?: VendorGroupByArgs['orderBy'];
    }, OrderFields extends Prisma.ExcludeUnderscoreKeys<Prisma.Keys<Prisma.MaybeTupleToUnion<T['orderBy']>>>, ByFields extends Prisma.MaybeTupleToUnion<T['by']>, ByValid extends Prisma.Has<ByFields, OrderFields>, HavingFields extends Prisma.GetHavingFields<T['having']>, HavingValid extends Prisma.Has<ByFields, HavingFields>, ByEmpty extends T['by'] extends never[] ? Prisma.True : Prisma.False, InputErrors extends ByEmpty extends Prisma.True ? `Error: "by" must not be empty.` : HavingValid extends Prisma.False ? {
        [P in HavingFields]: P extends ByFields ? never : P extends string ? `Error: Field "${P}" used in "having" needs to be provided in "by".` : [
            Error,
            'Field ',
            P,
            ` in "having" needs to be provided in "by"`
        ];
    }[HavingFields] : 'take' extends Prisma.Keys<T> ? 'orderBy' extends Prisma.Keys<T> ? ByValid extends Prisma.True ? {} : {
        [P in OrderFields]: P extends ByFields ? never : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
    }[OrderFields] : 'Error: If you provide "take", you also need to provide "orderBy"' : 'skip' extends Prisma.Keys<T> ? 'orderBy' extends Prisma.Keys<T> ? ByValid extends Prisma.True ? {} : {
        [P in OrderFields]: P extends ByFields ? never : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
    }[OrderFields] : 'Error: If you provide "skip", you also need to provide "orderBy"' : ByValid extends Prisma.True ? {} : {
        [P in OrderFields]: P extends ByFields ? never : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
    }[OrderFields]>(args: Prisma.SubsetIntersection<T, VendorGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetVendorGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>;
    /**
     * Fields of the Vendor model
     */
    readonly fields: VendorFieldRefs;
}
/**
 * The delegate class that acts as a "Promise-like" for Vendor.
 * Why is this prefixed with `Prisma__`?
 * Because we want to prevent naming conflicts as mentioned in
 * https://github.com/prisma/prisma-client-js/issues/707
 */
export interface Prisma__VendorClient<T, Null = never, ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise";
    user<T extends Prisma.UserDefaultArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.UserDefaultArgs<ExtArgs>>): Prisma.Prisma__UserClient<runtime.Types.Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>;
    products<T extends Prisma.Vendor$productsArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.Vendor$productsArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$ProductPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>;
    orders<T extends Prisma.Vendor$ordersArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.Vendor$ordersArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$OrderPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>;
    reviews<T extends Prisma.Vendor$reviewsArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.Vendor$reviewsArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$ReviewPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>;
    savedBy<T extends Prisma.Vendor$savedByArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.Vendor$savedByArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$SavedVendorPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>;
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): runtime.Types.Utils.JsPromise<TResult1 | TResult2>;
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): runtime.Types.Utils.JsPromise<T | TResult>;
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): runtime.Types.Utils.JsPromise<T>;
}
/**
 * Fields of the Vendor model
 */
export interface VendorFieldRefs {
    readonly id: Prisma.FieldRef<"Vendor", 'String'>;
    readonly user_id: Prisma.FieldRef<"Vendor", 'String'>;
    readonly shop_name: Prisma.FieldRef<"Vendor", 'String'>;
    readonly description: Prisma.FieldRef<"Vendor", 'String'>;
    readonly category: Prisma.FieldRef<"Vendor", 'String'>;
    readonly city: Prisma.FieldRef<"Vendor", 'String'>;
    readonly address: Prisma.FieldRef<"Vendor", 'String'>;
    readonly logo_url: Prisma.FieldRef<"Vendor", 'String'>;
    readonly lat: Prisma.FieldRef<"Vendor", 'Float'>;
    readonly lng: Prisma.FieldRef<"Vendor", 'Float'>;
    readonly is_verified: Prisma.FieldRef<"Vendor", 'Boolean'>;
    readonly is_active: Prisma.FieldRef<"Vendor", 'Boolean'>;
    readonly created_at: Prisma.FieldRef<"Vendor", 'DateTime'>;
    readonly updated_at: Prisma.FieldRef<"Vendor", 'DateTime'>;
}
/**
 * Vendor findUnique
 */
export type VendorFindUniqueArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Vendor
     */
    select?: Prisma.VendorSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Vendor
     */
    omit?: Prisma.VendorOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.VendorInclude<ExtArgs> | null;
    /**
     * Filter, which Vendor to fetch.
     */
    where: Prisma.VendorWhereUniqueInput;
};
/**
 * Vendor findUniqueOrThrow
 */
export type VendorFindUniqueOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Vendor
     */
    select?: Prisma.VendorSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Vendor
     */
    omit?: Prisma.VendorOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.VendorInclude<ExtArgs> | null;
    /**
     * Filter, which Vendor to fetch.
     */
    where: Prisma.VendorWhereUniqueInput;
};
/**
 * Vendor findFirst
 */
export type VendorFindFirstArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Vendor
     */
    select?: Prisma.VendorSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Vendor
     */
    omit?: Prisma.VendorOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.VendorInclude<ExtArgs> | null;
    /**
     * Filter, which Vendor to fetch.
     */
    where?: Prisma.VendorWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of Vendors to fetch.
     */
    orderBy?: Prisma.VendorOrderByWithRelationInput | Prisma.VendorOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for Vendors.
     */
    cursor?: Prisma.VendorWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` Vendors from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` Vendors.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of Vendors.
     */
    distinct?: Prisma.VendorScalarFieldEnum | Prisma.VendorScalarFieldEnum[];
};
/**
 * Vendor findFirstOrThrow
 */
export type VendorFindFirstOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Vendor
     */
    select?: Prisma.VendorSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Vendor
     */
    omit?: Prisma.VendorOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.VendorInclude<ExtArgs> | null;
    /**
     * Filter, which Vendor to fetch.
     */
    where?: Prisma.VendorWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of Vendors to fetch.
     */
    orderBy?: Prisma.VendorOrderByWithRelationInput | Prisma.VendorOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for Vendors.
     */
    cursor?: Prisma.VendorWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` Vendors from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` Vendors.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of Vendors.
     */
    distinct?: Prisma.VendorScalarFieldEnum | Prisma.VendorScalarFieldEnum[];
};
/**
 * Vendor findMany
 */
export type VendorFindManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Vendor
     */
    select?: Prisma.VendorSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Vendor
     */
    omit?: Prisma.VendorOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.VendorInclude<ExtArgs> | null;
    /**
     * Filter, which Vendors to fetch.
     */
    where?: Prisma.VendorWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of Vendors to fetch.
     */
    orderBy?: Prisma.VendorOrderByWithRelationInput | Prisma.VendorOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for listing Vendors.
     */
    cursor?: Prisma.VendorWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` Vendors from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` Vendors.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of Vendors.
     */
    distinct?: Prisma.VendorScalarFieldEnum | Prisma.VendorScalarFieldEnum[];
};
/**
 * Vendor create
 */
export type VendorCreateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Vendor
     */
    select?: Prisma.VendorSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Vendor
     */
    omit?: Prisma.VendorOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.VendorInclude<ExtArgs> | null;
    /**
     * The data needed to create a Vendor.
     */
    data: Prisma.XOR<Prisma.VendorCreateInput, Prisma.VendorUncheckedCreateInput>;
};
/**
 * Vendor createMany
 */
export type VendorCreateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * The data used to create many Vendors.
     */
    data: Prisma.VendorCreateManyInput | Prisma.VendorCreateManyInput[];
    skipDuplicates?: boolean;
};
/**
 * Vendor createManyAndReturn
 */
export type VendorCreateManyAndReturnArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Vendor
     */
    select?: Prisma.VendorSelectCreateManyAndReturn<ExtArgs> | null;
    /**
     * Omit specific fields from the Vendor
     */
    omit?: Prisma.VendorOmit<ExtArgs> | null;
    /**
     * The data used to create many Vendors.
     */
    data: Prisma.VendorCreateManyInput | Prisma.VendorCreateManyInput[];
    skipDuplicates?: boolean;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.VendorIncludeCreateManyAndReturn<ExtArgs> | null;
};
/**
 * Vendor update
 */
export type VendorUpdateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Vendor
     */
    select?: Prisma.VendorSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Vendor
     */
    omit?: Prisma.VendorOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.VendorInclude<ExtArgs> | null;
    /**
     * The data needed to update a Vendor.
     */
    data: Prisma.XOR<Prisma.VendorUpdateInput, Prisma.VendorUncheckedUpdateInput>;
    /**
     * Choose, which Vendor to update.
     */
    where: Prisma.VendorWhereUniqueInput;
};
/**
 * Vendor updateMany
 */
export type VendorUpdateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * The data used to update Vendors.
     */
    data: Prisma.XOR<Prisma.VendorUpdateManyMutationInput, Prisma.VendorUncheckedUpdateManyInput>;
    /**
     * Filter which Vendors to update
     */
    where?: Prisma.VendorWhereInput;
    /**
     * Limit how many Vendors to update.
     */
    limit?: number;
};
/**
 * Vendor updateManyAndReturn
 */
export type VendorUpdateManyAndReturnArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Vendor
     */
    select?: Prisma.VendorSelectUpdateManyAndReturn<ExtArgs> | null;
    /**
     * Omit specific fields from the Vendor
     */
    omit?: Prisma.VendorOmit<ExtArgs> | null;
    /**
     * The data used to update Vendors.
     */
    data: Prisma.XOR<Prisma.VendorUpdateManyMutationInput, Prisma.VendorUncheckedUpdateManyInput>;
    /**
     * Filter which Vendors to update
     */
    where?: Prisma.VendorWhereInput;
    /**
     * Limit how many Vendors to update.
     */
    limit?: number;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.VendorIncludeUpdateManyAndReturn<ExtArgs> | null;
};
/**
 * Vendor upsert
 */
export type VendorUpsertArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Vendor
     */
    select?: Prisma.VendorSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Vendor
     */
    omit?: Prisma.VendorOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.VendorInclude<ExtArgs> | null;
    /**
     * The filter to search for the Vendor to update in case it exists.
     */
    where: Prisma.VendorWhereUniqueInput;
    /**
     * In case the Vendor found by the `where` argument doesn't exist, create a new Vendor with this data.
     */
    create: Prisma.XOR<Prisma.VendorCreateInput, Prisma.VendorUncheckedCreateInput>;
    /**
     * In case the Vendor was found with the provided `where` argument, update it with this data.
     */
    update: Prisma.XOR<Prisma.VendorUpdateInput, Prisma.VendorUncheckedUpdateInput>;
};
/**
 * Vendor delete
 */
export type VendorDeleteArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Vendor
     */
    select?: Prisma.VendorSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Vendor
     */
    omit?: Prisma.VendorOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.VendorInclude<ExtArgs> | null;
    /**
     * Filter which Vendor to delete.
     */
    where: Prisma.VendorWhereUniqueInput;
};
/**
 * Vendor deleteMany
 */
export type VendorDeleteManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Filter which Vendors to delete
     */
    where?: Prisma.VendorWhereInput;
    /**
     * Limit how many Vendors to delete.
     */
    limit?: number;
};
/**
 * Vendor.products
 */
export type Vendor$productsArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Product
     */
    select?: Prisma.ProductSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Product
     */
    omit?: Prisma.ProductOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.ProductInclude<ExtArgs> | null;
    where?: Prisma.ProductWhereInput;
    orderBy?: Prisma.ProductOrderByWithRelationInput | Prisma.ProductOrderByWithRelationInput[];
    cursor?: Prisma.ProductWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.ProductScalarFieldEnum | Prisma.ProductScalarFieldEnum[];
};
/**
 * Vendor.orders
 */
export type Vendor$ordersArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Order
     */
    select?: Prisma.OrderSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Order
     */
    omit?: Prisma.OrderOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.OrderInclude<ExtArgs> | null;
    where?: Prisma.OrderWhereInput;
    orderBy?: Prisma.OrderOrderByWithRelationInput | Prisma.OrderOrderByWithRelationInput[];
    cursor?: Prisma.OrderWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.OrderScalarFieldEnum | Prisma.OrderScalarFieldEnum[];
};
/**
 * Vendor.reviews
 */
export type Vendor$reviewsArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Review
     */
    select?: Prisma.ReviewSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Review
     */
    omit?: Prisma.ReviewOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.ReviewInclude<ExtArgs> | null;
    where?: Prisma.ReviewWhereInput;
    orderBy?: Prisma.ReviewOrderByWithRelationInput | Prisma.ReviewOrderByWithRelationInput[];
    cursor?: Prisma.ReviewWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.ReviewScalarFieldEnum | Prisma.ReviewScalarFieldEnum[];
};
/**
 * Vendor.savedBy
 */
export type Vendor$savedByArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SavedVendor
     */
    select?: Prisma.SavedVendorSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the SavedVendor
     */
    omit?: Prisma.SavedVendorOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.SavedVendorInclude<ExtArgs> | null;
    where?: Prisma.SavedVendorWhereInput;
    orderBy?: Prisma.SavedVendorOrderByWithRelationInput | Prisma.SavedVendorOrderByWithRelationInput[];
    cursor?: Prisma.SavedVendorWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.SavedVendorScalarFieldEnum | Prisma.SavedVendorScalarFieldEnum[];
};
/**
 * Vendor without action
 */
export type VendorDefaultArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Vendor
     */
    select?: Prisma.VendorSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Vendor
     */
    omit?: Prisma.VendorOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.VendorInclude<ExtArgs> | null;
};
//# sourceMappingURL=Vendor.d.ts.map