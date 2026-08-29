#!/usr/bin/env bash
# scripts/read-env-key.sh
#
# Prints the value of one key from a .env-shaped file, with no shell
# expansion of any kind. This replaces `set -a; . ./.env; set +a` in
# deploy.sh, which handed every value in that file to the shell to
# execute -- an admin password hash in the spec §2.2 scrypt format,
# `$16384$8$1$<salt>$<key>`, is `$`-separated by design and sourcing it
# expands each `$N` as a positional parameter (spec §9.0 defect 1).
# A value here is read as text and only as text: this script never
# sources, evals or command-substitutes anything it reads.
#
# Matching is exact on the key name up to the first '=', and a line whose
# first non-blank character is '#' is a comment, not a candidate, even if
# the key text appears inside it. Leading whitespace before the key is
# tolerated -- the comment check and the key match both look at the same
# whitespace-trimmed line, so an indented assignment is read the same way
# sourcing would have read it, not silently missed. If the key is assigned
# more than once the last assignment wins, matching what sourcing did. A
# missing key prints nothing and exits 0, because absent and empty are the
# same thing to deploy.sh's `:?` checks.
#
# One layer of matching quotes is stripped if the value both starts and
# ends with the same quote character: K='v' and K="v" both yield v,
# K=''v'' yields 'v', and K='v (unmatched) is left alone.
#
# Usage:
#   read-env-key.sh <file> <key>
set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "read-env-key: expected 2 arguments (file key), got $#" >&2
  exit 1
fi

file=$1
key=$2

if [ ! -f "$file" ]; then
  echo "read-env-key: $file does not exist" >&2
  exit 1
fi

value=""
found=0

while IFS= read -r line || [ -n "$line" ]; do
  leading="${line%%[![:space:]]*}"
  trimmed="${line#"$leading"}"
  case "$trimmed" in
    ''|'#'*) continue ;;
  esac

  case "$trimmed" in
    "$key"=*)
      value="${trimmed#"$key"=}"
      found=1
      ;;
  esac
done < "$file"

if [ "$found" -eq 0 ]; then
  exit 0
fi

# Strip exactly one layer of matching quotes, if present.
len=${#value}
if [ "$len" -ge 2 ]; then
  first="${value:0:1}"
  last="${value: -1}"
  if { [ "$first" = "'" ] || [ "$first" = '"' ]; } && [ "$first" = "$last" ]; then
    value="${value:1:len-2}"
  fi
fi

printf '%s\n' "$value"
