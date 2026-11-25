<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('organizations', function (Blueprint $table) {
            $table->boolean('timer_enabled')->default(true);
        });

        // At most one running timer per person; it becomes a time entry when stopped.
        Schema::create('running_timers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->foreignId('project_id')->nullable()->constrained()->nullOnDelete();
            $table->text('description')->nullable();
            $table->boolean('is_billable')->nullable();
            $table->json('tags')->nullable();
            $table->timestamp('started_at');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('running_timers');

        Schema::table('organizations', function (Blueprint $table) {
            $table->dropColumn('timer_enabled');
        });
    }
};
