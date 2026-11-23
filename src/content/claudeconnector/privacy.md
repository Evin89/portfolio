# ClaudeConnector — Privacy Policy

_Effective date: 23 November 2026_

This policy explains what personal data **ClaudeConnector** (a Discord administration bot, a Builder Basement project) and its administration service ("connector") process, and why. It covers only the bot. Websites and apps on the servers where it is active have their own privacy information.

## 1. Who is responsible
Evin Wijninga (Builder Basement), Rotterdam, the Netherlands, is the controller for the processing described here.
Contact: [info@mordheimmanager.net](mailto:info@mordheimmanager.net).

## 2. The short version
- ClaudeConnector does **not** read, collect or store the content of your messages.
- ClaudeConnector does **not** keep a list of members or a profile of you.
- The only account data stored is the Discord user ID of the person who operates the bot (me).

## 3. Server members
ClaudeConnector has no live connection to a server's chat (no Discord "gateway"), no commands and no DMs. It only acts when I ask it to, and only on servers I have explicitly configured.

When I work on channel permissions, ClaudeConnector may look up the **nickname or username of members who have a permission setting on a specific channel**, so that the result shows names instead of numbers. Those names are used for that one request and are **not stored** by ClaudeConnector.

Messages that ClaudeConnector posts, and the actions it takes, are stored by Discord as part of the server (including Discord's audit log). That data is handled by Discord under its own [Privacy Policy](https://discord.com/privacy).

## 4. The operator
To use the connector, the operator signs in with Discord (scope `identify`). From that sign-in only the **Discord user ID** is used, to check that the account is allowed to operate the bot. The Discord sign-in token is used once and not kept. The connector stores:
- authorization records and access tokens for the connector, linked to that Discord user ID, until they expire or are revoked;
- a temporary sign-in state, deleted after at most 10 minutes.

## 5. Service providers
- **Discord** — the platform ClaudeConnector runs on.
- **Cloudflare** — hosts the connector (Cloudflare Workers and KV). Like any web host, Cloudflare may process technical data such as IP addresses in request logs.
- **Anthropic** — when I use the bot through Claude, the results of the bot's actions (such as channel and role names, and the member names described in section 3) are sent to Claude to complete that request. Anthropic handles this data under its own privacy terms.

These providers may process data outside the European Economic Area, including in the United States. They rely on safeguards such as the EU–US Data Privacy Framework or the European Commission's Standard Contractual Clauses.

## 6. Legal basis
The processing is based on my **legitimate interest** (Article 6(1)(f) GDPR) in administering the Discord servers I run in a safe and organised way, while keeping the data involved to a minimum.

## 7. Retention
- Member names (section 3): not stored.
- Operator authorization data: until it expires or is revoked.
- Sign-in state: at most 10 minutes.
- Hosting logs: as long as Cloudflare keeps them under its own policy.

## 8. Your rights
Under the GDPR you have the right to access, correct or delete your personal data, to restrict or object to its processing, and to data portability. Contact me using the details in section 1. You also have the right to lodge a complaint with the Dutch Data Protection Authority ([Autoriteit Persoonsgegevens](https://www.autoriteitpersoonsgegevens.nl)) or the supervisory authority in your own country.

## 9. Age
ClaudeConnector is only used on servers that follow Discord's minimum age requirements. It does not knowingly process data of children below that age.

## 10. Changes
I may update this policy. The effective date above shows the latest version. Significant changes will be announced on the Discord servers where ClaudeConnector is active.

See also the [Terms of Service](/claudeconnector/terms/).
