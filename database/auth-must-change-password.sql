-- Adds AppUser.MustChangePassword to an existing CMS database (re-runnable).
--
-- Every existing row still holds a default password (set by create / reset-password),
-- so the column defaults to 1 and all current users must change it at their next login.
-- Fresh databases get the column from auth.sql / admin.sql instead.
USE [CMS]
GO
IF COL_LENGTH('dbo.AppUser', 'MustChangePassword') IS NULL
BEGIN
    ALTER TABLE [dbo].[AppUser] ADD [MustChangePassword] [bit] NOT NULL
        CONSTRAINT [DF_AppUser_MustChangePassword] DEFAULT ((1));
END
GO
