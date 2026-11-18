<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('time_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('project_id')->constrained()->restrictOnDelete();
            $table->text('description')->nullable();
            // UTC.
            $table->timestamp('started_at');
            $table->timestamp('ended_at');
            $table->unsignedInteger('duration_seconds');
            $table->boolean('is_billable')->default(true);
            // Rate at the time the entry was saved, minor currency unit (öre).
            $table->unsignedInteger('hourly_rate')->nullable();
            $table->string('source', 16)->default('web');
            $table->timestamps();
            $table->softDeletes();

            $table->index(['organization_id', 'user_id', 'started_at']);
            $table->index(['organization_id', 'project_id', 'started_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('time_entries');
    }
};
