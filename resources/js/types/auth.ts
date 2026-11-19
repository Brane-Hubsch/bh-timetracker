export type User = {
    id: number;
    name: string;
    email: string;
    avatar_url: string | null;
    /** The picture to show (128 px): the uploaded one, else the one from Google. */
    avatar: string | null;
    locale: string;
    timezone: string;
    email_verified_at: string | null;
    created_at: string;
    updated_at: string;
};

export type Auth = {
    user: User;
};

export type Passkey = {
    id: number;
    name: string;
    authenticator: string | null;
    created_at_diff: string;
    last_used_at_diff: string | null;
};
