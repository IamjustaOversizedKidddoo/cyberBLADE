import { createJsonStore, dataPath } from "@/lib/storage/json-store";
import { StoreProgressRepo } from "./repo";
import { emptyProgress } from "./types";

/** Local-first progress in .data/progress.json (replaced by Supabase in the hosted phase). */
export class FileProgressRepo extends StoreProgressRepo {
  constructor(filePath = dataPath("progress.json")) {
    super(createJsonStore(filePath, emptyProgress));
  }
}
