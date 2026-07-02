import { MedusaService } from "@medusajs/framework/utils"
import { Artist } from "./models/artist"
import { JournalPost } from "./models/journal-post"

// Auto-generates list/retrieve/create/update/delete for both models:
// listArtists, createArtists, listJournalPosts, ...
class BrandModuleService extends MedusaService({ Artist, JournalPost }) {}

export default BrandModuleService
