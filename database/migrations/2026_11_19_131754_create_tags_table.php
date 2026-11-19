<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tags per organization, and the tags on each time entry.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tags', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->string('name', 50);
            $table->timestamps();

            $table->unique(['organization_id', 'name']);
        });

        Schema::create('tag_time_entry', function (Blueprint $table) {
            $table->foreignId('tag_id')->constrained()->cascadeOnDelete();
            $table->foreignId('time_entry_id')->constrained()->cascadeOnDelete();

            $table->primary(['tag_id', 'time_entry_id']);
            $table->index('time_entry_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tag_time_entry');
        Schema::dropIfExists('tags');
    }
};
