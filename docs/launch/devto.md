---
title: "Redline: catching breaking API changes before you merge, in the browser"
published: false
tags: openapi, typescript, webdev, api
---

I maintain a few OpenAPI specs, and the same small anxiety shows up every time I edit one: right
before I open the pull request, I want to know whether I just broke a client. Not "did the YAML
change" but "will an app already calling this API stop working."

The proper tools for this (`oasdiff`, `openapi-diff`) are built for CI. You install a binary or a
GitHub Action, write a config file, wire it into a pipeline, and wait for a run. That's the right
tool for enforcement. It's the wrong tool for the ten seconds before I hit "create PR," when I just
want a fast, honest gut-check. So I built **Redline**: paste the old spec, paste the new spec, get
a red/green tree that marks every change breaking or safe with a one-line reason. It runs entirely
in the browser, and nothing is uploaded anywhere.

Here are two decisions that turned out to be more interesting than I expected.

## `$ref` resolution has to survive cycles, and specs that don't fully resolve

A text diff of two spec files is dominated by noise that has nothing to do with compatibility:
a schema moves from inline to `components/schemas`, keys get reordered, a `$ref` target is renamed.
So the first thing the engine does is resolve every local `$ref` before comparing, so two specs
that are structurally identical but organized differently produce zero diff.

The catch is that schemas reference themselves. A `Tree` node with a `children` array of `Tree`
nodes will happily send a naive resolver into an infinite loop. The fix is to track the set of
pointers currently being expanded along the current path, and when you hit one that's already
active, stop and keep the `$ref` in place instead of expanding it again:

```ts
if (activeRefs.has(pointer)) {
  return { $ref: pointer }; // cycle boundary: keep the pointer, don't expand forever
}
return walk(value, new Set([...activeRefs, pointer]));
```

Two identical circular specs then compare as equal, because the preserved pointers are equal. The
same idea covers the messier real-world case: external refs (`./models.yaml#/User`) and dangling
pointers that don't resolve locally are left verbatim rather than throwing, so a spec full of them
still diffs the parts that do resolve.

## Add/remove is breaking or safe depending on which side of the wire you're on

The rule I kept getting backwards by hand is that request and response schemas invert. Removing a
field from a **response** is breaking (a client reading it will find it gone). Removing a field
from a **request** is safe (the client just stops sending something the server no longer needs).
A newly required **request** field is breaking; a newly required **response** field is safe.

So the schema differ carries a `direction: "request" | "response"` through the whole recursion, and
every verdict is a small named function rather than an inline condition. That made the rules
testable in isolation and gave me something honest to put in the UI: every red node ships with the
sentence explaining why, sourced from the same rule that decided the color.

## One bug I didn't see coming: a nesting bomb

While testing malformed input, a payload of thousands of open braces (`{{{{...`) didn't produce a
clean parse error. It produced a raw "Maximum call stack size exceeded," because the YAML parser's
recursive descent blew the stack. No real OpenAPI document nests anywhere near that deep, so the
parser now does a cheap flow-nesting-depth scan first (skipping quoted strings so a brace inside a
string doesn't count) and rejects anything past 200 levels with a designed error before the parser
ever sees it.

## What I'd do differently

The compatibility rules cover the surfaces that actually break clients (paths, operations,
parameters, request/response bodies), but not yet `oneOf`/`allOf` composition or webhooks. Those
are next. If I started over I'd model the "direction" concept from day one instead of retrofitting
it once the request/response asymmetry bit me.

The whole thing is a static site with no backend. Try it: <https://apps.charliekrug.com/api-breakcheck/>
Code: <https://github.com/ctkrug/api-breakcheck>
