import "@supabase/postgrest-js";

declare module "@supabase/postgrest-js" {
  interface PostgrestQueryBuilder<
    Schema,
    Relation,
    RelationName = unknown,
    Relationships = unknown
  > {
    /**
     * Operational tables can land through reviewed SQL before generated client
     * types are refreshed. This overload keeps runtime validation in the domain
     * service while avoiding false-negative insert unions during that window.
     */
    insert(values: Record<string, unknown> | Array<Record<string, unknown>>, options?: Record<string, unknown>): any;
  }
}
