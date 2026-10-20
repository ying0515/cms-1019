USE [CMS]
GO
/****** Object:  Table [dbo].[ModelPrice] ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ModelPrice](
	[pkid] [int] IDENTITY(1,1) NOT NULL,
	[Model] [nvarchar](100) NOT NULL,
	[EffectiveFrom] [date] NOT NULL,
	[InputPrice] [decimal](18, 6) NOT NULL,
	[OutputPrice] [decimal](18, 6) NOT NULL,
	[CacheWritePrice] [decimal](18, 6) NOT NULL,
	[CacheReadPrice] [decimal](18, 6) NOT NULL,
 CONSTRAINT [PK_ModelPrice] PRIMARY KEY CLUSTERED
(
	[pkid] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [IX_ModelPrice_Model_EffectiveFrom] UNIQUE NONCLUSTERED
(
	[Model] ASC,
	[EffectiveFrom] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[AgentTokenUsage] ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[AgentTokenUsage](
	[pkid] [int] IDENTITY(1,1) NOT NULL,
	[SessionId] [nvarchar](100) NOT NULL,
	[UsageDate] [date] NOT NULL,
	[Model] [nvarchar](100) NOT NULL,
	[UserId] [nvarchar](200) NOT NULL,
	[Project] [nvarchar](200) NOT NULL,
	[InputTokens] [bigint] NOT NULL,
	[OutputTokens] [bigint] NOT NULL,
	[CacheWriteTokens] [bigint] NOT NULL,
	[CacheReadTokens] [bigint] NOT NULL,
	[Cost] [decimal](18, 6) NULL,
	[UpdatedTime] [datetime] NOT NULL,
 CONSTRAINT [PK_AgentTokenUsage] PRIMARY KEY CLUSTERED
(
	[pkid] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [IX_AgentTokenUsage_Session_Date_Model] UNIQUE NONCLUSTERED
(
	[SessionId] ASC,
	[UsageDate] ASC,
	[Model] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
CREATE NONCLUSTERED INDEX [IX_AgentTokenUsage_UsageDate] ON [dbo].[AgentTokenUsage]
(
	[UsageDate] ASC
)
INCLUDE ([UserId], [Project], [Model], [InputTokens], [OutputTokens], [CacheWriteTokens], [CacheReadTokens], [Cost])
GO
ALTER TABLE [dbo].[AgentTokenUsage] ADD  CONSTRAINT [DF_AgentTokenUsage_UpdatedTime]  DEFAULT (getutcdate()) FOR [UpdatedTime]
GO
ALTER TABLE [dbo].[AgentTokenUsage]  WITH CHECK ADD  CONSTRAINT [FK_AgentTokenUsage_AppUser] FOREIGN KEY([UserId])
REFERENCES [dbo].[AppUser] ([UserId])
GO
ALTER TABLE [dbo].[AgentTokenUsage] CHECK CONSTRAINT [FK_AgentTokenUsage_AppUser]
GO
