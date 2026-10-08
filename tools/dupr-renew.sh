#!/bin/bash
# DUPR token renewal — run by the Hermes cron job "DUPR token renewal".
# Silent while the token is fresh (the tool skips before touching the network);
# prints only when a renewal happened or something failed (the job's no_agent
# watchdog pattern: empty stdout = no message).
cd "/c/Code/craft/pickleball" 2>/dev/null || cd "C:/Code/craft/pickleball" || exit 0
out=$(npx tsx tools/dupr-auth.ts 2>&1)
case "$out" in
  *"still fresh"*) exit 0 ;;
  *) echo "DUPR token ritual:"; echo "$out" | tail -3 ;;
esac
