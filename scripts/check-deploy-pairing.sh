#!/usr/bin/env bash
# scripts/check-deploy-pairing.sh
#
# Fail-closed guard on the STACK_NAME / HOST_PORT / APP_ORIGIN /
# ALLOW_DEV_LOGIN / APP_DIR pairing (spec §2). Exits 0 only when all five
# arguments match one full row of the table below, taken verbatim from
# spec §1.
#
# Matched by exact string equality, field by field, against a fixed table
# of the two legal rows -- not by heuristics such as "does the origin
# contain stg". A substring check like that is exactly how a hostname added
# later silently becomes production, which is the failure this script
# exists to close off (spec §2).
#
# app_dir is the fifth field, added by the spec §1.3 correction. The first
# four fields only ever validated what was written INSIDE a .env file for
# mutual consistency; they cannot tell which .env was read. That is exactly
# how the first production deploy redeployed staging and exited 0 -- run
# from staging's directory, staging's own .env is a perfectly legal row.
# app_dir closes that gap by checking the directory the deploy actually ran
# from against the directory the matched row says it must run from.
#
# Usage:
#   check-deploy-pairing.sh <stack_name> <host_port> <app_origin> <allow_dev_login> <app_dir>
set -euo pipefail

if [ "$#" -ne 5 ]; then
  echo "check-deploy-pairing: expected 5 arguments (stack_name host_port app_origin allow_dev_login app_dir), got $#" >&2
  exit 1
fi

stack_name=$1
host_port=$2
app_origin=$3
allow_dev_login=$4
app_dir=$5

# stack_name, host_port, app_origin and app_dir must always be present. Only
# ALLOW_DEV_LOGIN may legitimately be empty, and only on the rows below
# that say so (spec §2).
if [ -z "$stack_name" ] || [ -z "$host_port" ] || [ -z "$app_origin" ] || [ -z "$app_dir" ]; then
  echo "check-deploy-pairing: stack_name, host_port, app_origin and app_dir are required and must not be empty" >&2
  exit 1
fi

# The table, verbatim from spec §1. Two legal rows. TABLE_ALLOW_DESC is only
# the human-readable description of the legal ALLOW_DEV_LOGIN set for that
# row, used in the error message below; the actual legality check is the
# case statement further down, matched on row index so it cannot be fooled
# by shell word-splitting on an empty field.
TABLE_STACK=(confession confession-prod)
TABLE_PORT=(8182 8082)
TABLE_ORIGIN=("https://stg.confession.fayad.app" "https://confession.fayad.app")
TABLE_ALLOW_DESC=("'1' or empty" "empty")
TABLE_DIR=(/srv/apps/confession /srv/apps/confession-prod)

matched_index=-1
for i in "${!TABLE_STACK[@]}"; do
  if [ "${TABLE_STACK[$i]}" = "$stack_name" ]; then
    matched_index=$i
    break
  fi
done

if [ "$matched_index" -eq -1 ]; then
  echo "check-deploy-pairing: unknown STACK_NAME '$stack_name' -- expected one of: ${TABLE_STACK[*]}" >&2
  exit 1
fi

expected_port="${TABLE_PORT[$matched_index]}"
expected_origin="${TABLE_ORIGIN[$matched_index]}"
expected_allow_desc="${TABLE_ALLOW_DESC[$matched_index]}"

if [ "$host_port" != "$expected_port" ]; then
  echo "check-deploy-pairing: HOST_PORT mismatch for STACK_NAME '$stack_name' -- got '$host_port', expected '$expected_port'" >&2
  exit 1
fi

if [ "$app_origin" != "$expected_origin" ]; then
  echo "check-deploy-pairing: APP_ORIGIN mismatch for STACK_NAME '$stack_name' -- got '$app_origin', expected '$expected_origin'" >&2
  exit 1
fi

# A trailing slash is accepted and stripped before comparison; nothing else
# is normalised (spec §2). This is a directory identity check, not a path
# equivalence check -- it must catch the exact failure of §1.3, which was a
# deploy run from the other stack's directory outright, not a formatting
# quirk.
expected_dir="${TABLE_DIR[$matched_index]}"
app_dir_stripped="${app_dir%/}"
if [ "$app_dir_stripped" != "$expected_dir" ]; then
  echo "check-deploy-pairing: app_dir mismatch for STACK_NAME '$stack_name' -- got '$app_dir', expected '$expected_dir'" >&2
  exit 1
fi

# Row 0 (confession/staging): "1" or empty are both legal.
# Row 1 (confession-prod): only empty is legal -- "1" is refused, which is
# the belt-and-braces check spec §2 asks for alongside src/env.ts's own
# boot-time refusal.
case "${matched_index}:${allow_dev_login}" in
  0:1 | 0: | 1:) ;;
  *)
    echo "check-deploy-pairing: ALLOW_DEV_LOGIN mismatch for STACK_NAME '$stack_name' -- got '$allow_dev_login', expected $expected_allow_desc" >&2
    exit 1
    ;;
esac

exit 0
