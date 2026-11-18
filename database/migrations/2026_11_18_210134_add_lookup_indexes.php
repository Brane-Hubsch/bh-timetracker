<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Indexes for frequent lookups that are not covered by an existing index. Postgres does not index
 * foreign keys automatically.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('organization_members', function (Blueprint $table) {
            $table->index('user_id');
        });

        Schema::table('organization_invitations', function (Blueprint $table) {
            $table->index('organization_id');
        });

        Schema::table('projects', function (Blueprint $table) {
            $table->index('client_id');
        });

        Schema::table('project_members', function (Blueprint $table) {
            $table->index('user_id');
        });

        Schema::table('time_entries', function (Blueprint $table) {
            // Team reports and dashboards filter on the organization and a period without a member.
            $table->index(['organization_id', 'started_at']);
        });

        Schema::table('magic_links', function (Blueprint $table) {
            $table->index('user_id');
        });
    }

    public function down(): void
    {
        Schema::table('organization_members', fn (Blueprint $table) => $table->dropIndex(['user_id']));
        Schema::table('organization_invitations', fn (Blueprint $table) => $table->dropIndex(['organization_id']));
        Schema::table('projects', fn (Blueprint $table) => $table->dropIndex(['client_id']));
        Schema::table('project_members', fn (Blueprint $table) => $table->dropIndex(['user_id']));
        Schema::table('time_entries', fn (Blueprint $table) => $table->dropIndex(['organization_id', 'started_at']));
        Schema::table('magic_links', fn (Blueprint $table) => $table->dropIndex(['user_id']));
    }
};
