create table if not exists "PepperSizeReference" (
  "id" text not null primary key,
  "code" text not null,
  "label" text not null,
  "sortOrder" integer not null default 0,
  "createdAt" timestamp(3) not null default current_timestamp,
  "updatedAt" timestamp(3) not null default current_timestamp
);

create unique index if not exists "PepperSizeReference_code_key"
  on "PepperSizeReference" ("code");

create table if not exists "PepperColorReference" (
  "id" text not null primary key,
  "code" text not null,
  "label" text not null,
  "sortOrder" integer not null default 0,
  "createdAt" timestamp(3) not null default current_timestamp,
  "updatedAt" timestamp(3) not null default current_timestamp
);

create unique index if not exists "PepperColorReference_code_key"
  on "PepperColorReference" ("code");

-- Depois de criar as tabelas, execute no projeto:
-- npm run foundation:references:sync
