create table loadout (
    id          uuid         primary key,
    frame       varchar(40)  not null,
    name        varchar(60)  not null,
    creator     varchar(40)  not null,
    favorite    boolean      not null default false,

    -- Attachments (empty string = not set)
    skin        varchar(80)  not null default '',
    helmet      varchar(80)  not null default '',
    chest       varchar(80)  not null default '',
    arms        varchar(80)  not null default '',
    legs        varchar(80)  not null default '',
    ephemera    varchar(80)  not null default '',
    signa       varchar(80)  not null default '',
    syandana    varchar(80)  not null default '',

    created_at  timestamptz  not null,
    updated_at  timestamptz  not null,
    version     bigint       not null default 0
);

-- The per-frame cap and the Collection grid both look loadouts up by frame.
create index idx_loadout_frame on loadout (frame);

-- One row per color channel (primary, secondary, ... energy II) per loadout.
create table loadout_color (
    loadout_id  uuid         not null references loadout (id) on delete cascade,
    channel     varchar(16)  not null,
    palette     varchar(60)  not null,
    row_index   smallint     not null check (row_index between 0 and 17),
    col_index   smallint     not null check (col_index between 0 and 4),
    hex         char(7)      not null check (hex ~ '^#[0-9a-fA-F]{6}$'),
    label       varchar(60)  not null,
    primary key (loadout_id, channel)
);
