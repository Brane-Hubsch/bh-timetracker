<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('organizations', function (Blueprint $table) {
            $table->boolean('team_enabled')->default(false);
        });

        Schema::table('organization_members', function (Blueprint $table) {
            $table->unsignedTinyInteger('week_starts_on')->nullable();
            $table->json('working_days')->nullable();
            $table->unsignedInteger('workday_seconds')->nullable();
            $table->string('avatar_path')->nullable();
        });

        DB::table('organizations')
            ->whereIn('id', DB::table('organization_members')->select('organization_id')->groupBy('organization_id')->havingRaw('COUNT(*) > 1'))
            ->orWhereIn('id', DB::table('organization_invitations')->select('organization_id')->whereNotNull('accepted_at'))
            ->update(['team_enabled' => true]);
    }

    public function down(): void
    {
        Schema::table('organization_members', function (Blueprint $table) {
            $table->dropColumn(['week_starts_on', 'working_days', 'workday_seconds', 'avatar_path']);
        });

        Schema::table('organizations', function (Blueprint $table) {
            $table->dropColumn('team_enabled');
        });
    }
};
