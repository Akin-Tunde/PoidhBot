export interface Cast {
  hash: string;
  text: string;
  author: {
    fid: number;
    username: string;
    displayName: string;
  };
  timestamp: string;
  reactions: {
    likes: number;
    recasts: number;
  };
  replies: number;
}

export interface FarcasterConfig {
  apiKey: string;
  signerUuid: string;
  fid: number;
}

export interface SocialMetrics {
  totalCasts: number;
  totalEngagement: number;
  tipsReceived: bigint;
  followerCount: number;
}
