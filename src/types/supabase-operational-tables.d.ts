import "@supabase/postgrest-js";

declare module "@supabase/postgrest-js" {
  interface PostgrestQueryBuilder<
    Schema,
    Relation,
    RelationName = unknown,
    Relationships = unknown
  > {
    /**
     * `whatsapp_conversations` is introduced by the reviewed Phase 2B SQL
     * migration before the generated client types are refreshed. This overload
     * is only available for that relation; all existing tables retain strict
     * Supabase inference.
     */
    insert(
      this: RelationName extends "whatsapp_conversations"
        ? PostgrestQueryBuilder<Schema, Relation, RelationName, Relationships>
        : never,
      values: Record<string, unknown> | Array<Record<string, unknown>>,
      options?: Record<string, unknown>
    ): any;
  }
}
