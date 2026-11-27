<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->string('theme', 20)->default('standard');
            // Null follows the organization's accent.
            $table->string('accent', 20)->nullable();
            $table->string('contrast', 20)->default('system');
        });

        Schema::table('organizations', function (Blueprint $table): void {
            // Null is the default violet.
            $table->string('accent', 20)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropColumn(['theme', 'accent', 'contrast']);
        });

        Schema::table('organizations', function (Blueprint $table): void {
            $table->dropColumn('accent');
        });
    }
};
