export const DISCORD_COMMANDS = [
  {
    name: "setup",
    description: "Post the rank application panel in this channel.",
    default_member_permissions: String(1 << 3),
  },
  {
    name: "help",
    description: "Show available commands and how ranking works.",
  },
  {
    name: "leaderboard",
    description: "Show ranker activity — who's reviewed the most applications.",
    options: [
      {
        type: 4,
        name: "days",
        description: "Only count the last N days (omit for all-time).",
        required: false,
        min_value: 1,
        max_value: 3650,
      },
    ],
  },
];
