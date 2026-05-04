import discord
from discord.ext import commands
from discord import app_commands
import asyncio
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# ══════════════════════════════════════════════════════════════
#  CONFIG  —  fill these in before running
# ══════════════════════════════════════════════════════════════
BOT_TOKEN      = os.getenv("BOT_TOKEN")
RANKER_ROLE_ID = 1500916350212902992   # role that can click rank buttons

# Custom animated emoji to use for waiting status.
# Replace 123456789012345678 with your clock emoji ID from the server.
CLOCK_EMOJI = "<a:clock:1500929391360741446>"

# Each rank: label shown on button + the Discord Role ID to assign
RANKS = [
    {"label": "Grand Champion Editor", "role_id": 1500379922500419604},
    {"label": "Champion Editor",    "role_id": 1500378910964060300},
    {"label": "Pro Editor",         "role_id": 1500378551298428988},
    {"label": "Diamond Editor",     "role_id": 1500379769626296404},
    {"label": "Gold Editor",        "role_id": 1500379642987679837},
    {"label": "Silver Editor",      "role_id": 1500581757920219136},
    {"label": "Decent Editor",      "role_id": 1500378787173498880},
]
# ══════════════════════════════════════════════════════════════


# ── MODAL ─────────────────────────────────────────────────────────────────────

class RankApplicationModal(discord.ui.Modal, title="Rank Application"):

    edit = discord.ui.TextInput(
        label="Edit Link",
        style=discord.TextStyle.short,
        placeholder="https://tiktok.com/...",
        required=True,
        max_length=256,
    )

    app_used = discord.ui.TextInput(
        label="App Used",
        style=discord.TextStyle.short,
        placeholder="e.g., After Effects, Premiere Pro, etc.",
        required=True,
        max_length=128,
    )

    async def on_submit(self, interaction: discord.Interaction):
        await interaction.response.defer(ephemeral=True)

        user    = interaction.user
        channel = interaction.channel.parent if isinstance(interaction.channel, discord.Thread) else interaction.channel

        # Check if channel is a forum channel
        if not isinstance(channel, discord.ForumChannel):
            await interaction.followup.send(
                "❌ Applications can only be submitted in forum channels.",
                ephemeral=True
            )
            return

        # Get the ranker role
        ranker_role = interaction.guild.get_role(RANKER_ROLE_ID)

        # Build submission embed
        embed = discord.Embed(
            title="Rank Application",
            color=discord.Color.yellow(),
        )
        embed.set_thumbnail(url=user.display_avatar.url)
        embed.add_field(name="User",            value=user.mention,                             inline=False)
        embed.add_field(name="Edit Link", value=f"[Click here]({self.edit.value})",  inline=False)
        embed.add_field(name="App Used",        value=self.app_used.value,                      inline=False)
        embed.add_field(name="Status",          value=f"{CLOCK_EMOJI} Waiting for rank...",                   inline=False)
        embed.set_footer(text=f"Applicant ID: {user.id}")

        view = RankButtonsView(applicant_id=user.id)

        if isinstance(channel, discord.ForumChannel):
            # Create forum post
            thread = await channel.create_thread(
                name=f"{user.display_name}'s Application",
                content="New rank application submitted!",
                reason="Rank application",
            )
            # Send embed and view as the first message in the thread
            await thread.thread.send(embed=embed, view=view)
            thread_obj = thread.thread
        else:
            thread = await channel.create_thread(
                name=f"{user.display_name}'s Application",
                type=discord.ChannelType.public_thread,
                reason="Rank application",
            )
            await thread.send(embed=embed, view=view)
            thread_obj = thread

        await interaction.followup.send(
            f"✅ Application submitted! {thread_obj.mention}\n"
            f"⏰ This thread will be automatically deleted in 4 hours.\n"
            f"Please wait for a ranker to review your application.",
            ephemeral=True,
        )

        # Announce the new application in the created thread if the channel is a forum
        announce_target = thread_obj if isinstance(channel, discord.ForumChannel) else channel
        await announce_target.send(
            f"📝 {user.mention} has submitted a rank application! {thread_obj.mention}\n"
            f"⏰ This thread will be automatically deleted in 4 hours."
        )

        # Auto-delete the thread after 4 hours
        async def delete_thread_after_delay(thread_target, delay):
            await asyncio.sleep(delay)
            try:
                await thread_target.delete()
            except discord.NotFound:
                pass  # Thread already deleted

        interaction.client.loop.create_task(delete_thread_after_delay(thread_obj, 4 * 3600))


# ── RANK BUTTONS (inside the thread) ──────────────────────────────────────────

class RankButton(discord.ui.Button):
    def __init__(self, rank: dict, applicant_id: int, row: int):
        super().__init__(
            label=rank["label"],
            style=discord.ButtonStyle.secondary,
            custom_id=f"rank_{rank['label'].replace(' ', '_')}_{applicant_id}",
            row=row,
        )
        self.rank         = rank
        self.applicant_id = applicant_id

    async def callback(self, interaction: discord.Interaction):
        ranker_role = interaction.guild.get_role(RANKER_ROLE_ID)
        if ranker_role is None or ranker_role not in interaction.user.roles:
            try:
                await interaction.response.send_message(
                    "❌ You don't have permission to assign ranks. Only the ranker role can use these buttons.",
                    ephemeral=True,
                )
            except discord.errors.InteractionResponded:
                await interaction.followup.send(
                    "❌ You don't have permission to assign ranks. Only the ranker role can use these buttons.",
                    ephemeral=True,
                )
            return

        await interaction.response.defer()

        guild     = interaction.guild
        applicant = guild.get_member(self.applicant_id)

        # Assign the Discord role
        role = guild.get_role(self.rank["role_id"])
        if applicant and role:
            try:
                await applicant.add_roles(role, reason=f"Ranked by {interaction.user}")
            except discord.errors.Forbidden:
                await interaction.followup.send(
                    f"❌ I don't have permission to assign the **{self.rank['label']}** role. "
                    f"Please make sure the bot's role is higher than that role.",
                    ephemeral=True,
                )
                return

        # Rebuild the embed with updated Status field
        old_embed = interaction.message.embeds[0]
        new_embed = discord.Embed(
            title=old_embed.title,
            color=discord.Color.green(),
        )
        if old_embed.thumbnail:
            new_embed.set_thumbnail(url=old_embed.thumbnail.url)

        for field in old_embed.fields:
            if field.name == "Status":
                new_embed.add_field(
                    name="Status",
                    value=f"✅ Assigned: **{self.rank['label']}**",
                    inline=False,
                )
            else:
                new_embed.add_field(name=field.name, value=field.value, inline=field.inline)

        new_embed.set_footer(text=f"Ranked by {interaction.user} • {old_embed.footer.text}")

        # Disable all buttons
        for child in self.view.children:
            child.disabled = True

        await interaction.message.edit(embed=new_embed, view=self.view)

        mention = applicant.mention if applicant else f"<@{self.applicant_id}>"
        await interaction.channel.send(
            f"🎉 {mention} has been ranked **{self.rank['label']}** by {interaction.user.mention}!"
        )


class RankButtonsView(discord.ui.View):
    def __init__(self, applicant_id: int):
        super().__init__(timeout=None)
        for i, rank in enumerate(RANKS):
            row = i // 5
            self.add_item(RankButton(rank=rank, applicant_id=applicant_id, row=row))


# ── PERSISTENT BUTTON (setup panel) ─────────────────────────────────────────

class GetRankedButton(discord.ui.Button):
    def __init__(self):
        super().__init__(
            label="Get Ranked",
            style=discord.ButtonStyle.primary,
            custom_id="get_ranked_button",
            emoji="🏆",
        )

    async def callback(self, interaction: discord.Interaction):
        try:
            await interaction.response.send_modal(RankApplicationModal())
        except (discord.errors.NotFound, discord.errors.HTTPException) as e:
            # Interaction expired or already acknowledged, defer and try follow-up
            try:
                await interaction.response.defer(ephemeral=True)
                await interaction.followup.send(
                    "The interaction expired. Please try clicking the button again.",
                    ephemeral=True
                )
            except Exception as follow_up_error:
                print(f"Error in button callback: {e}, Follow-up error: {follow_up_error}")


class PersistentSetupView(discord.ui.View):
    def __init__(self):
        super().__init__(timeout=None)
        self.add_item(GetRankedButton())


# ── BOT ───────────────────────────────────────────────────────────────────────

intents = discord.Intents.default()
intents.members = True

bot = commands.Bot(command_prefix="!", intents=intents)


async def setup_hook():
    bot.add_view(PersistentSetupView())

bot.setup_hook = setup_hook


@bot.event
async def on_ready():
    await bot.tree.sync()
    print(f"✅ Logged in as {bot.user} — slash commands synced.")


@bot.tree.command(name="setup", description="Post the GET RANKED embed in this channel.")
@app_commands.checks.has_permissions(administrator=True)
async def setup(interaction: discord.Interaction):
    # Defer to prevent timeout
    await interaction.response.defer()
    
    embed = discord.Embed(
        title="GET RANKED",
        description=(
            "Click the button below to fill out your application.\n\n"
            "**Rank Tiers** (Highest → Lowest)\n"
            "👑 Grand Champion Editor\n"
            "🏆 Champion Editor\n"
            "⚡ Pro Editor\n"
            "💎 Diamond Editor\n"
            "🥇 Gold Editor\n"
            "🥈 Silver Editor\n"
            "✅ Decent Editor"
        ),
        color=discord.Color.blurple(),
    )
    embed.set_footer(text="Select the button below to begin your application.")

    await interaction.followup.send(embed=embed, view=PersistentSetupView())


# ── RUN ───────────────────────────────────────────────────────────────────────
bot.run(BOT_TOKEN)
