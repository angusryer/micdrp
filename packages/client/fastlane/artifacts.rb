# Cleaning up after a release — INV-UPD-012, INV-UPD-013.
#
# gym leaves two things behind on every run: an .xcarchive of a gigabyte or
# so, and the IPA and dSYM bundle in the output directory. Neither is read
# again once the build is on TestFlight. Nine releases filled the disk and
# stopped everything on the machine, so this runs on every successful upload
# rather than being left to whoever notices.
#
# Incremental build state is deliberately untouched. The lane archives
# incrementally on purpose, and clearing DerivedData would turn every release
# into a full native rebuild — a real cost, paid every time, to reclaim space
# the next build immediately allocates again.
require "fileutils"

module Artifacts
  # How many past builds' artefacts to keep, newest first. Enough to hand
  # someone a previous IPA or symbolicate a crash from a build or two back.
  KEEP = 3

  ARCHIVES = File.expand_path("~/Library/Developer/Xcode/Archives")

  # Remove the archive gym just wrote. The IPA is the artefact that matters;
  # the archive is scaffolding, and symbols are kept separately as the dSYM.
  def self.discard_archive(path)
    return unless path && File.exist?(path)

    FileUtils.rm_rf(path)
    UI.message("cleaned up archive #{File.basename(path)}")
  end

  # Drop empty date directories Xcode leaves behind once their archives go.
  def self.prune_empty_archive_dirs
    return unless Dir.exist?(ARCHIVES)

    Dir.glob(File.join(ARCHIVES, "*")).select { |d| File.directory?(d) }.each do |dir|
      Dir.rmdir(dir) if Dir.empty?(dir)
    end
  rescue SystemCallError
    # Something else is writing in there. Not worth failing a shipped build.
  end

  # Keep the newest KEEP of each artefact kind and delete the rest.
  #
  # Grouped by extension so a run of IPAs never evicts the dSYMs, and sorted
  # by modification time so the build just produced is always among the
  # newest — INV-UPD-013 holds even if KEEP is set to zero, because the
  # current build is excluded before the window is applied.
  def self.prune_outputs(dir, current_name)
    return unless Dir.exist?(dir)

    %w[ipa app.dSYM.zip].each do |suffix|
      found = Dir.glob(File.join(dir, "*.#{suffix}"))
                 .reject { |f| File.basename(f).start_with?(current_name.to_s.sub(/\.ipa\z/, "")) }
                 .sort_by { |f| File.mtime(f) }
                 .reverse

      found.drop(KEEP).each do |stale|
        File.delete(stale)
        UI.message("cleaned up #{File.basename(stale)}")
      end
    end
  end

  # Everything a finished release should tidy, in one call.
  #
  # The archive path is passed in rather than read here: lane_context is a
  # lane-scope helper and is not in scope inside a module.
  def self.after_upload(archive:, output_dir:, output_name:)
    discard_archive(archive)
    prune_empty_archive_dirs
    prune_outputs(output_dir, output_name)
  end
end
