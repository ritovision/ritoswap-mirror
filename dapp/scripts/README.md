If you are testing the collection in one automated sweep, if /form-submission-gate executes before /gate-access, the token will be registered as "used" and will return a forbidden warning.

If BACKDOOR_TOKEN=true is enabled and the token "used" status resets, it defaults to a 5 second reset interval. This will still cause /gate-access to fail because it executes too quickly for the reset.

You have to set `BACKDOOR_DELAY_MS=1` in the environment running the api so it can reset the token quickly enough for gate-access to pass successfully in that execution order.