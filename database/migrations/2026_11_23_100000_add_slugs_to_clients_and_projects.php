<?php

use App\Support\ResourceSlug;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        foreach (['clients' => 'client', 'projects' => 'project'] as $tableName => $fallback) {
            Schema::table($tableName, function (Blueprint $table) {
                $table->string('slug')->nullable();
                $table->unique(['organization_id', 'slug']);
            });

            DB::table($tableName)->select(['id', 'organization_id', 'name'])->whereNull('slug')
                ->chunkById(500, function (Collection $rows) use ($tableName, $fallback) {
                    foreach ($rows as $row) {
                        $organizationRows = DB::table($tableName)->where('organization_id', $row->organization_id);
                        $slug = ResourceSlug::available($organizationRows, $row->name, $fallback);

                        DB::table($tableName)->where('id', $row->id)->update(['slug' => $slug]);
                    }
                });

            Schema::table($tableName, fn (Blueprint $table) => $table->string('slug')->change());
        }
    }

    public function down(): void
    {
        foreach (['clients', 'projects'] as $tableName) {
            Schema::table($tableName, function (Blueprint $table) {
                $table->dropUnique(['organization_id', 'slug']);
                $table->dropColumn('slug');
            });
        }
    }
};
