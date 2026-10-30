# Week 32: an image the container cannot read never replaces a running one

Frozen 2026-10-30, before the change to `Dockerfile` and `deploy.sh` was
written and before the test was written.

## §0 What is wrong, measured

Week 31, 2026-10-28: the production tree was untarred in a shell that had
`umask 077` set for the database dump. Every file came out 600 and every
directory 700. `COPY` keeps those modes and makes the owner root, so inside
the image the `node` user (uid 1000) could not read
`/usr/local/bin/docker-entrypoint.sh`. `deploy.sh` built the image, ran
`docker compose up`, which stopped the healthy container and started the new
one, and then waited ten minutes for a container that restart-looped.
`masaraha.provefair.app` answered 503 from about 22:15 to 22:26:38.

Two separate defects:

1. **The image depends on the modes of the uploaded tree.** Nothing in the
   `Dockerfile` decides who can read the files it ships. The entrypoint is
   the one that failed first; `check-env.mjs`, `migrate.mjs`,
   `bootstrap-admin.mjs`, `drizzle/*.sql` and `public/` come from the same
   tree by the same route and would have failed next.
2. **`deploy.sh` swaps first and finds out later.** The only check after the
   build is the health wait, which runs after `compose up` has already
   removed the working container. Any image that cannot start costs
   production its uptime for the length of that wait.

Measured 2026-10-30 on the server: the live image `confession-web:93d826e`
run as its own user through `scripts/check-image-readable.mjs` (§1.2):
`2609 paths usable by uid 1000`, exit 0. The same `main` tree untarred
under `umask 077` and built unchanged: see §4.

## §1 The change

### §1.1 `Dockerfile`: the image decides its own file modes

In the `build` stage, right after `COPY . .`, every path the source tree
contributed (everything under `/app` except `node_modules`, which the `deps`
stage wrote itself) is set to `a+rX,go-w`: readable by everyone, directories
enterable, writable only by the owner (root). The build stage never ships,
so this costs the runtime image nothing.

The runtime stage copies `docker-entrypoint.sh` from the `build` stage
instead of from the context, so it too carries the normalised mode, and
sets it to `755` explicitly instead of `+x`. Nothing in the runtime image
becomes writable by `node`: the app code stays root-owned.

After this, a tree uploaded as 600/700 and a tree uploaded as 644/755 build
images whose files have the same modes.

### §1.2 `scripts/check-image-readable.mjs`: the check

A node script with no dependencies, run inside an image as the image's own
user. Arguments: the entrypoint path first, then any number of directories
or files.

- The entrypoint must be readable and executable.
- A directory must be readable and enterable, and is walked.
- A file must be readable.
- A symlink is judged by its target; a dangling symlink fails. A symlink to
  a directory is checked but not walked.
- Exit 0 with one line on stdout naming the number of paths and the uid.
- Exit 1 with the count and the first 20 failing paths on stderr, each with
  the reason, then `... and N more` if there are more.
- Exit 2 with a usage line when no argument is given.

It reads no environment, opens no file for writing and needs no network.

### §1.3 `deploy.sh`: check between build and swap

After `docker build` and before `docker compose up`:

    docker run --rm -i --network none --entrypoint node "$CONFESSION_IMAGE_TAG" \
      --input-type=module - /usr/local/bin/docker-entrypoint.sh /app \
      < "$REPO_DIR/scripts/check-image-readable.mjs"

The script reaches the image on stdin, so the image under test is not
changed to carry its own check. No `.env`, no secret and no network reach
that container. On a non-zero exit `deploy.sh` prints that it refused and
that the running stack was not touched, and exits 1 before `compose up`.

## §2 Rejected

- **A check in `deploy.sh` on the uploaded tree's modes.** It would refuse
  a 600 tree that §1.1 builds correctly, and it would not catch an image
  that is unreadable for any other reason (a future `COPY`, a base image
  change). The image is the thing that runs; the image is what gets checked.
- **`COPY --chmod=`.** Needs BuildKit, takes an octal mode for files and
  directories alike in the frontend this box has not been measured on, and
  has to be repeated on every `COPY`; one missed line is the week 31 bug
  again. Normalising once in the build stage covers every later
  `COPY --from=build`.
- **`COPY --chown=node:node`.** Makes the app code writable by the process
  that serves the internet. The code stays root-owned.
- **`RUN chmod -R` in the runtime stage.** Duplicates every touched file into
  a new layer, roughly doubling those bytes in the image.
- **Starting the new container beside the old one and swapping on healthy.**
  The right shape for zero-downtime deploys, but it needs a second port and
  a proxy change, and the proxy is root's. Out of scope; the check above
  removes this failure class without it.
- **`umask 022` at the top of `deploy.sh`.** The untar happens before
  `deploy.sh` runs, in the build session's shell. It would not have helped.

## §3 What the test must prove

`test/83-image-readable.test.ts`, written by a different hand from this spec,
in a tree that does not hold the change.

1. The script, run on a temporary tree that is fully readable, exits 0 and
   prints a count that matches the number of paths it was given and found.
2. A file with mode 000 inside a walked directory: exit 1, the path and
   "not readable" on stderr.
3. A directory with mode 000: exit 1, named; its contents are not listed.
4. An entrypoint with mode 644 (readable, not executable): exit 1, named.
5. An entrypoint that does not exist: exit 1, named.
6. A dangling symlink: exit 1, named. A symlink to a readable file: fine.
7. More than 20 failures: exactly 20 listed, then `... and N more` with the
   right N.
8. No arguments: exit 2.
9. `Dockerfile`: the `build` stage normalises modes after `COPY . .` and
   before any runtime `COPY --from=build`, and the runtime entrypoint is
   copied from the `build` stage, not from the context. (The behaviour is
   proved on the server, §4; this guards the text against a revert.)
10. `deploy.sh`: the check runs after `docker build` and before
    `docker compose ... up`, uses `--network none`, passes no `--env-file`
    and no `-e`, and a failure exits non-zero before `up`. Proved by running
    `deploy.sh` with a stub `docker` on `PATH` that records its calls and
    fails the `run`: the record holds `build` and `run`, and no `compose`.
    The real pairing check refuses any directory but the two under
    `/srv/apps`, so the test copies `deploy.sh` into a temporary
    `<app>/repo/` with a stub `scripts/check-deploy-pairing.sh` that exits
    0, the real `scripts/read-env-key.sh` and
    `scripts/check-image-readable.mjs`, a `DEPLOY_VERSION` and an `.env`.
    With the stub `run` succeeding instead, the record holds `build`, `run`,
    then `compose`, in that order.

The test runs as a non-root user (the build sessions do), where mode 000 is
unreadable to the owner.

## §4 What the server must show before this ships

On asam-prod-01, in a scratch directory, never in a live app directory:

1. `main` (`93d826e`) untarred under `umask 077` and built unchanged: the
   check fails on the entrypoint. This is week 31 reproduced.
2. This branch untarred under `umask 077` and built: the check passes, and
   the path count matches the live image's within the files this branch
   adds.
3. Staging deployed from this branch untarred under `umask 077`, through
   `deploy.sh`: healthy, 200 from outside.
4. Staging, with this branch's `deploy.sh` and `main`'s `Dockerfile`,
   untarred under `umask 077`: `deploy.sh` refuses, and staging still
   answers 200 from outside on the image it had.
5. Production, after staging, from the same tarball, under `umask 022`.

## §5 Amended 2026-10-30, after the independent review

The review (verdict FAIL, no blocker) found four holes, all measured, and
this section closes them. §1 to §4 stand except where changed here.

### §5.1 What the review found

1. `deploy.sh` trusted the exit code alone. `node --input-type=module -`
   with an empty stdin exits 0 and prints nothing, so a truncated or empty
   `check-image-readable.mjs` let any image through.
2. The check proved that what is present is readable, not that what the
   entrypoint needs is present. A missing `server.js` or `migrate.mjs`
   passes and then restart-loops after the swap: the week 31 outage by
   another road.
3. Run as uid 0, `access()` says yes to everything readable and the check
   is a silent no-op. Nothing refused that.
4. Test 83 could not tell `access()` from a check on the owner mode bits
   (every fixture is owned by the test user), and the Dockerfile tests were
   text-only: removing `-R` from the chmod still passed all 29.

### §5.2 The change

1. **The script refuses uid 0**: exit 1, `runs as root` on stderr, before
   any path is checked. It also refuses when `process.getuid` is absent.
2. **A missing path is a failure the script names**, as `cannot stat`
   already was. A directory that cannot be listed (`readdirSync` throws)
   is reported as a failure with its error code instead of a stack trace.
3. **On success the last line of stdout is exactly**
   `check-image-readable: OK <count> paths usable by uid <uid>`.
4. **`deploy.sh` passes the files the entrypoint and CMD need by name**,
   after the entrypoint and before `/app`: `/app/server.js`,
   `/app/check-env.mjs`, `/app/migrate.mjs`, `/app/bootstrap-admin.mjs`.
5. **`deploy.sh` captures the check's stdout and goes on only when the exit
   is 0 and stdout has a line matching**
   `^check-image-readable: OK [1-9][0-9]* paths usable by uid [1-9][0-9]*$`.
   Anything else refuses, prints the exit code, and removes the refused
   image's tag (`docker image rm`, failure ignored) so a later manual
   `compose up` cannot start it. The running stack is not touched.
6. **The check's `docker run` carries no `--user`/`-u`, `--privileged`,
   `--cap-add`, `-p`/`--publish` or `--add-host`.**

### §5.3 What the test must add

11. A stub `docker run` that exits 0 and prints nothing: `deploy.sh`
    refuses, and the record holds no `compose`. Same for a stub printing
    `check-image-readable: OK 0 paths usable by uid 1000` and for one
    printing the line with uid 0.
12. On refusal, the record holds `image rm` (or `rmi`) with the image tag,
    after `run` and with no `compose`.
13. The check's arguments are exactly
    `/usr/local/bin/docker-entrypoint.sh /app/server.js /app/check-env.mjs /app/migrate.mjs /app/bootstrap-admin.mjs /app`.
14. A missing path given as an argument: exit 1, named.
15. A directory that is readable and enterable but whose listing fails is
    not constructible as a non-root user; skip it. A directory with mode
    100 (enterable, not readable): exit 1, named, no stack trace on stderr.
16. The success line format of §5.2.3, with the right count.
17. **The Dockerfile chmod, run.** Take the `RUN find ...` line from the
    `build` stage, run its command with `sh -c` and the working path
    `/app` replaced by a temporary directory holding a tree of 600 files,
    700 directories at two levels of nesting, one 700 script and a
    `node_modules/` whose file is 600. After: every file outside
    `node_modules` is 644 or 755 (the script 755), every directory 755,
    the `node_modules` file still 600.
18. The flags of §5.2.6 are absent from the check's `docker run`.

The uid 0 refusal and the root-owned 600 case cannot be produced by a
non-root test. They are proved on the server (§5.4), not in test 83.

### §5.4 Added to §4

6. The fixed image run as `--user 0`: the check refuses.
7. The fixed image with `/app/migrate.mjs` deleted in a throwaway
   container layer: the check refuses and names it.

## §6 Amended 2026-10-30, after the second review

The second review passed the change and found that §5.3 was wrong to call
two cases untestable without root.

19. **`access()`, not "any permission bit".** A file the test user owns with
    mode 044, and a directory with mode 055, are readable by group and
    other but not by their owner: `access()` refuses them, a check on
    `mode & 0o444` would not. Both: exit 1, named.
20. **The uid 0 refusal.** Run the script with a `--import` preload that
    sets `process.getuid = () => 0`: exit 1, `runs as root` on stderr, no OK
    line on stdout, and no path reported. A second preload that deletes
    `process.getuid`: the same.

Only "root can read a 600 file" itself needs real root, and that is the
server run of §4.1 and §5.4.6.
