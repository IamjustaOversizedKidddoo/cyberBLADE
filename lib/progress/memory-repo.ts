import { createMemoryStore } from "@/lib/storage/memory-store";
import { StoreProgressRepo } from "./repo";
import { emptyProgress } from "./types";

export class MemoryProgressRepo extends StoreProgressRepo {
  constructor() {
    super(createMemoryStore(emptyProgress));
  }
}
