-- Accounts are created on first Google sign-in. Google's stable subject id is the identity key;
-- email and name are display data that can change.
create table app_user (
    id              uuid          primary key,
    google_subject  varchar(255)  not null unique,
    email           varchar(320)  not null,
    display_name    varchar(120)  not null,
    avatar_url      varchar(1024),
    created_at      timestamptz   not null,
    last_login_at   timestamptz   not null
);

-- Loadouts created before accounts existed have no owner yet; the first account to sign in
-- adopts them (see UserService). New loadouts always get an owner.
alter table loadout
    add column owner_id uuid references app_user (id) on delete cascade;

-- Every query is "this user's loadouts", usually also filtered by frame.
create index idx_loadout_owner_frame on loadout (owner_id, frame);
drop index idx_loadout_frame;
