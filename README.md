# invite-to.me register

free subdomains for discord bots, servers and side projects: `yourname.invite-to.me`.

you can claim a name on [invite-to.me](https://invite-to.me) in a few clicks, or register it
here with a pull request. both end up in the same place and count toward the same limit.

## how to register

1. fork this repo
2. add a file `domains/<name>.json`. the file name is your name, so `domains/mybot.json`
   gives you `mybot.invite-to.me`
3. open a pull request. a check runs by itself and tells you if anything needs fixing
4. once a maintainer merges it, the name goes live within a minute or two

names are 3 to 32 characters: `a-z`, `0-9` and hyphens, not starting or ending with a
hyphen and no double hyphens. some names (`www`, `api`, `docs`, `mail`, `discord`, ...)
are reserved.

## the file

every file has an `owner` and either a `redirect` or `records`.
`owner.github` has to be your github username, the same account that opens the pr.

### send people to your bot invite

```json
{
  "owner": { "github": "yourname" },
  "redirect": { "type": "bot", "value": "123456789012345678" }
}
```

`value` is your bot's client id, or a full `discord.com/oauth2/authorize?...` link if you
want specific scopes or permissions.

### send people to your server

```json
{
  "owner": { "github": "yourname" },
  "redirect": { "type": "server", "value": "https://discord.gg/abc123" }
}
```

an invite code (`abc123`) works too. use an invite that doesn't expire.

### send people to any link

```json
{
  "owner": { "github": "yourname" },
  "redirect": { "type": "url", "value": "https://example.com/my-project" }
}
```

https only, and not back to invite-to.me.

### a site on vercel

```json
{
  "owner": { "github": "yourname" },
  "records": [{ "type": "CNAME", "host": "@", "content": "cname.vercel-dns.com" }]
}
```

then add `yourname.invite-to.me` as a domain in your vercel project.

### github pages

```json
{
  "owner": { "github": "yourname" },
  "records": [{ "type": "CNAME", "host": "@", "content": "yourname.github.io" }]
}
```

then set the custom domain in your repo's pages settings.

### your own server, plus discord's domain check

```json
{
  "owner": { "github": "yourname", "discord": "yourname" },
  "description": "my bot's dashboard",
  "records": [
    { "type": "A", "host": "@", "content": "203.0.113.10" },
    { "type": "TXT", "host": "_discord", "content": "dh=your-discord-verification-value" }
  ]
}
```

### records

| field     | what it is                                                                  |
| --------- | --------------------------------------------------------------------------- |
| `type`    | `CNAME`, `A`, `AAAA` or `TXT`. `NS` and `MX` aren't allowed                  |
| `host`    | `@` (default) for the name itself, or one label like `www` or `_discord`     |
| `content` | the target: a hostname, an ip or the txt value                               |
| `proxied` | `true` to put cloudflare's proxy in front (a, aaaa and cname only)          |

up to 10 records per name. a cname can't share its host with any other record.
add `"$schema": "../schema.json"` at the top of your file to get autocomplete in your editor.

## rules

- bots, servers, portfolios, side projects, docs: yes
- phishing, token grabbers, fake nitro, malware, mass spam: no
- pretending to be discord, another bot or another person: no

every link goes through google safe browsing when it's added and again later.
breaking the rules gets the name pulled. report abuse at
[invite-to.me/report](https://invite-to.me/report).

## limits

5 names per github account, **website names included**. if you already have 3 names on
invite-to.me (logged in with this github account), you can register 2 more here.

## changing or removing a name

edit your file or delete it in a new pull request. only the owner in the current file can
change or remove it. names registered here are managed here, so the website shows them
with an "edit on github" link instead of a delete button.

to give a name to someone else, open an issue and a maintainer will move it.

## checking locally

```sh
node scripts/check.mjs
```

checks that every file is valid json. the full check (availability, limits, link safety)
runs on your pull request.

## for maintainers

- repo variables: `API_URL` (`https://invite-to.me`) and `MAINTAINERS` (comma separated
  github usernames who may change files outside `domains/`)
- repo secret: `REGISTRY_SYNC_TOKEN`, the same value as on the app
- `sync` runs after every merge into `main`, daily, and by hand. it refuses to remove a lot
  of names at once unless you run it by hand with `force`
