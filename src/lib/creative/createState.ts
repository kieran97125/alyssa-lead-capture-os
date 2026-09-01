export type CreativeJobCreateState = {
  status: "idle" | "error";
  message: string;
};

export const initialCreativeJobCreateState: CreativeJobCreateState = {
  status: "idle",
  message: "",
};
