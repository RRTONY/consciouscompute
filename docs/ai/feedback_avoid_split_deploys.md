# Avoid Split Deploys

> Keep one feature's logic in one deployed place

Conscious Compute rule: logic split between a local script and a separately deployed service has to be run and redeployed in two places, and the two drift apart. The team wants each feature's logic in one place, and leftover files deleted.

**How to apply:** When a feature spans a script plus a live service, prefer putting the logic in the one live place. When consolidating, also clean up dead references (docs, comments) to the removed piece.
