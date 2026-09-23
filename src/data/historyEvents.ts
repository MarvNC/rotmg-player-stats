export type HistoryEvent = {
  date: string;
  /** Inclusive final day for events that span multiple days. */
  end?: string;
  title: string;
  description: string;
  sources: Array<{ label: string; url: string }>;
};

/** Major live milestones within the chart's date range. Dates are UTC calendar days. */
export const HISTORY_EVENTS: HistoryEvent[] = [
  {
    date: "2016-07-21",
    title: "DECA takes over operations",
    description: "DECA named July 21 as its official operational handover from Kabam. Customer support was still being transferred.",
    sources: [
      { label: "DECA announcement", url: "https://www.reddit.com/r/RotMG/comments/4tlbld/its_nearly_official/" },
      { label: "Archived announcement", url: "https://wikiwiki.jp/rmd/version/build_27.7.DECA" },
    ],
  },
  {
    date: "2017-07-18",
    title: "The Nest released",
    description: "The Nest joined the game as a new endgame dungeon.",
    sources: [{ label: "Patch notes", url: "https://store.steampowered.com/news/posts/?appids=200210&enddate=1504633361" }],
  },
  {
    date: "2017-08-01",
    end: "2017-09-05",
    title: "MotMG 2017",
    description: "Month of the Mad God ran alongside the game's first DECA anniversary.",
    sources: [{ label: "Patch notes", url: "https://store.steampowered.com/news/posts/?appids=200210&enddate=1504633361" }],
  },
  {
    date: "2017-08-01",
    title: "Lost Halls released",
    description: "Lost Halls went live at the start of MotMG.",
    sources: [{ label: "Patch notes", url: "https://store.steampowered.com/news/posts/?appids=200210&enddate=1504633361" }],
  },
  {
    date: "2018-05-30",
    title: "Lost Halls reworked",
    description: "A major rework of Lost Halls arrived alongside guild and social interface changes.",
    sources: [{ label: "Patch notes", url: "https://store.steampowered.com/news/posts/?appids=200210&enddate=1528822315" }],
  },
  {
    date: "2018-07-31",
    end: "2018-09-06",
    title: "MotMG 2018",
    description: "Month of the Mad God featured new events, rewards, and the Samurai release.",
    sources: [
      { label: "Patch notes", url: "https://store.steampowered.com/news/posts/?appids=200210&enddate=1558705603" },
      { label: "Event calendar", url: "https://i.imgur.com/A4YEQiM.jpg" },
    ],
  },
  {
    date: "2018-07-31",
    title: "Samurai released",
    description: "Samurai became the game's 15th playable class.",
    sources: [{ label: "Patch notes", url: "https://store.steampowered.com/news/posts/?appids=200210&enddate=1558705603" }],
  },
  {
    date: "2019-07-10",
    end: "2019-08-20",
    title: "MotMG: Alien Invasion",
    description: "The annual event introduced alien invasions and new Realm encounters.",
    sources: [
      { label: "Launch notes", url: "https://store.steampowered.com/news/posts/?appids=200210&enddate=1583930973" },
      { label: "DECA end announcement", url: "https://www.reddit.com/r/RotMG/comments/ck9cf3/" },
    ],
  },
  {
    date: "2020-04-15",
    title: "Exalt Open Beta opens to everyone",
    description: "The Unity client became available to all players. A free Open Beta Bonus Program ran through May 6.",
    sources: [{ label: "DECA announcement", url: "https://store.steampowered.com/news/posts/?appids=200210&enddate=1587479768" }],
  },
  {
    date: "2020-05-22",
    title: "Bard released",
    description: "Bard was the first new class in roughly two years.",
    sources: [{ label: "DECA update", url: "https://remaster.realmofthemadgod.com/?p=542" }],
  },
  {
    date: "2020-07-22",
    title: "Exalt released and Oryx 3 arrived",
    description: "Exalt became the official client as Oryx's Sanctuary and Oryx 3 launched.",
    sources: [{ label: "DECA announcement", url: "https://remaster.realmofthemadgod.com/?p=667" }],
  },
  {
    date: "2020-09-23",
    title: "Flash client ends",
    description: "The Flash client became unavailable as Exalt became the only way to play.",
    sources: [{ label: "Flash cutoff", url: "https://remaster.realmofthemadgod.com/?p=718" }],
  },
  {
    date: "2020-09-23",
    end: "2020-10-28",
    title: "MotMG: Reconstruction",
    description: "Month of the Mad God brought Exaltations, dungeon reworks, and other Reconstruction content.",
    sources: [
      { label: "DECA event dates", url: "https://remaster.realmofthemadgod.com/?p=748" },
    ],
  },
  {
    date: "2021-03-30",
    title: "Summoner released",
    description: "Summoner arrived with Deadwater Docks and Sprite World reworks.",
    sources: [{ label: "Patch notes", url: "https://support.rotmg.com/hc/en-us/articles/360059184911-Patch-1-4-Unleashing-the-Summoner" }],
  },
  {
    date: "2021-08-17",
    end: "2021-09-27",
    title: "MotMG: Antinomy",
    description: "The annual event began with new content and systems. Its final announced event ended September 27.",
    sources: [
      { label: "Patch notes", url: "https://support.rotmg.com/hc/en-us/articles/4407346797197-Update-2-0-Month-of-the-Mad-God" },
      { label: "Final event week", url: "https://remaster.realmofthemadgod.com/?p=2285" },
    ],
  },
  {
    date: "2021-08-24",
    title: "Dungeon Modifiers introduced",
    description: "Dungeon Modifiers added varying conditions and rewards to dungeon runs.",
    sources: [{ label: "DECA release notes", url: "https://remaster.realmofthemadgod.com/?p=2127" }],
  },
  {
    date: "2021-08-26",
    title: "Shatters rework released",
    description: "The Shatters returned as a rebuilt endgame dungeon.",
    sources: [{ label: "Patch notes", url: "https://remaster.realmofthemadgod.com/?p=2156" }],
  },
  {
    date: "2021-12-14",
    title: "Kensei released",
    description: "The Kensei class arrived with the Oryxmas update.",
    sources: [{ label: "Patch notes", url: "https://remaster.realmofthemadgod.com/?p=2747" }],
  },
  {
    date: "2022-08-02",
    end: "2022-09-06",
    title: "MotMG 2022",
    description: "Month of the Mad God ran with Syndicate content, a Battlepass, and new goals.",
    sources: [
      { label: "Launch notes", url: "https://remaster.realmofthemadgod.com/?p=3381" },
      { label: "End update", url: "https://remaster.realmofthemadgod.com/?p=3429" },
    ],
  },
  {
    date: "2022-08-02",
    title: "Battlepass and seasons introduced",
    description: "MotMG launched the recurring season structure and Battlepass.",
    sources: [{ label: "Patch notes", url: "https://remaster.realmofthemadgod.com/?p=3381" }],
  },
  {
    date: "2022-11-22",
    title: "Seasonal characters introduced",
    description: "Players could create seasonal characters with progression tied to each season.",
    sources: [{ label: "Patch notes", url: "https://remaster.realmofthemadgod.com/?p=3529" }],
  },
  {
    date: "2023-03-28",
    title: "Moonlight Village released",
    description: "Moonlight Village joined the endgame dungeon lineup.",
    sources: [{ label: "Patch notes", url: "https://remaster.realmofthemadgod.com/?p=3648" }],
  },
  {
    date: "2023-08-01",
    end: "2023-09-05",
    title: "MotMG 2023",
    description: "Month of the Mad God brought the Echoes of Destiny event and a free campaign.",
    sources: [
      { label: "Patch notes", url: "https://remaster.realmofthemadgod.com/?p=3880" },
      { label: "Event calendar", url: "https://storage.googleapis.com/rotmg_images_public/News/MOTMG-Calendar-V23.jpg" },
    ],
  },
  {
    date: "2023-08-01",
    title: "Enchantments released",
    description: "The Enchantment system rolled out broadly with MotMG.",
    sources: [{ label: "Patch notes", url: "https://remaster.realmofthemadgod.com/?p=3880" }],
  },
  {
    date: "2024-04-23",
    title: "Realm Rework live beta",
    description: "Redesigned Realms became playable on live servers alongside the old Realms.",
    sources: [{ label: "Launch notes", url: "https://remaster.realmofthemadgod.com/?p=4117" }],
  },
  {
    date: "2024-07-30",
    end: "2024-08-20",
    title: "MotMG: Paths of Legends",
    description: "The annual event introduced competing factions, missions, and new rewards.",
    sources: [{ label: "Patch notes", url: "https://remaster.realmofthemadgod.com/?p=4172" }],
  },
  {
    date: "2024-11-26",
    title: "Reworked Realms replace old Realms",
    description: "The Realm Rework became the definitive experience after its live beta.",
    sources: [{ label: "Patch notes", url: "https://remaster.realmofthemadgod.com/?p=4337" }],
  },
  {
    date: "2025-03-11",
    title: "Account Levels introduced",
    description: "A new permanent account progression system went live.",
    sources: [{ label: "Patch notes", url: "https://remaster.realmofthemadgod.com/?p=4408" }],
  },
  {
    date: "2025-09-02",
    end: "2025-09-30",
    title: "MotMG: Shadow of the Legion",
    description: "The annual event began with Legion enemies and Nightmatter rewards. Its published dungeon and quest schedule ran through September 30.",
    sources: [{ label: "Patch notes", url: "https://remaster.realmofthemadgod.com/?p=4642" }],
  },
  {
    date: "2026-02-24",
    title: "Druid released",
    description: "Druid joined the class roster. RealmEye did not count Druid players until April 12.",
    sources: [{ label: "Patch notes", url: "https://remaster.realmofthemadgod.com/?p=5769" }],
  },
  {
    date: "2026-09-01",
    end: "2026-10-06",
    title: "MotMG: Time Chamber",
    description: "MotMG began with the Time Chamber and legacy dungeons. The Battle Pass is scheduled through October 6; the full event's end date has not been confirmed.",
    sources: [{ label: "DECA announcement", url: "https://hub.realmofthemadgod.com/news0/updates0/motmg" }],
  },
];
