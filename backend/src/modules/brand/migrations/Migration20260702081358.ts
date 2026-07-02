import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260702081358 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "journal_post" drop constraint if exists "journal_post_handle_unique";`);
    this.addSql(`alter table if exists "artist" drop constraint if exists "artist_handle_unique";`);
    this.addSql(`create table if not exists "artist" ("id" text not null, "name" text not null, "handle" text not null, "medium" text not null default '', "location" text not null default '', "tint" text not null default '20,42,84', "quote" text not null default '', "bio" text not null default '', "instagram" text not null default '', "portfolio" text not null default '', "image_url" text null, "featured" boolean not null default false, "status" text check ("status" in ('active', 'inactive')) not null default 'active', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "artist_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_artist_handle_unique" ON "artist" ("handle") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_artist_deleted_at" ON "artist" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "journal_post" ("id" text not null, "title" text not null, "handle" text not null, "category" text not null default '', "read_time" text not null default '', "author" text not null default 'Atelier OMG', "published_date" text not null default '', "excerpt" text not null default '', "body" text not null default '', "tint" text not null default '20,42,84', "image_url" text null, "status" text check ("status" in ('draft', 'published')) not null default 'draft', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "journal_post_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_journal_post_handle_unique" ON "journal_post" ("handle") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_journal_post_deleted_at" ON "journal_post" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "artist" cascade;`);

    this.addSql(`drop table if exists "journal_post" cascade;`);
  }

}
