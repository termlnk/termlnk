-- M6: The legacy `auditor` role was removed (recording is now an owner-driven
-- session policy, not derived from the role). Normalize any historic rows to
-- 'observer' so the runtime never sees the deprecated value. The read-side
-- normalization in PairingService.toTokenState is removed in the same commit.
UPDATE `collab_invite_token` SET `role` = 'observer' WHERE `role` = 'auditor';
