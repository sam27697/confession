#!/usr/bin/env bash
# scripts/check-deploy-pairing.sh
#
# Fail-closed guard on the STACK_NAME / HOST_PORT / APP_ORIGIN /
# ALLOW_DEV_LOGIN pairing (spec §2). Exits 0 only when all four arguments
# match one full row of the table below, taken verbatim from spec §1.
#
# Matched by exact string equality, field by field, against a fixed table
# of the two legal rows -- not by heuristics such as "does the origin
# contain stg". A substring check like that is exactly how a hostname added
# later silently becomes production, which is the failure this script
# exists to close off (spec §2).
#
# Usage:
#   check-deploy-pairing.sh <stack_name> <host_port> <app_origin> <allow_dev_login>
set -euo pipefail

if [ "$#" -ne 4 ]; then
  echo "check-deploy-pairing: expected 4 arguments (stack_name host_port app_origin allow_dev_login), got $#" >&2
  exit 1
fi

stack_name=$1
host_port=$2
app_origin=$3
allow_dev_login=$4

# stack_name, host_port and app_origin must always be present. Only
# ALLOW_DEV_LOGIN may legitimately be empty, and only on the rows below
# that say so (spec §2).
if [ -z "$stack_name" ] || [ -z "$host_port" ] || [ -z "$app_origin" ]; then
  echo "check-deploy-pairing: stack_name, host_port and app_origin are required and must not be empty" >&2
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
