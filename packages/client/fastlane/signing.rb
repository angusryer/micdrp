# signing.rb — read signing identity back out of the artifacts Apple issued.
#
# Apple, not this repo, decides the profile name and the team id. Hardcoding
# either means a value that silently goes stale: a wrong DEVELOPMENT_TEAM
# fails as "No profile for team X matching Y found", which reads like a
# missing profile rather than the mismatch it is.

module Signing
  # Decode a .mobileprovision (CMS-signed plist) and return its plist hash.
  def self.profile_plist(path)
    xml = `security cms -D -i #{path.to_s.shellescape} 2>/dev/null`
    raise "Could not decode provisioning profile at #{path}" if xml.empty?
    Plist.parse_xml(xml)
  end

  def self.team_id(profile_path)
    Array(profile_plist(profile_path)["TeamIdentifier"]).first
  end

  def self.name(profile_path)
    profile_plist(profile_path)["Name"]
  end

  # True when the project already carries exactly these signing settings.
  # Rewriting project.pbxproj changes its mtime, which invalidates Xcode's
  # incremental state and forces a full rebuild — so writing settings that
  # are already correct costs a few minutes per release for no effect.
  def self.settings_current?(project_path, profile_name:, team_id:)
    pbxproj = File.join(project_path, "project.pbxproj")
    return false unless File.exist?(pbxproj)
    body = File.read(pbxproj)
    body.include?(%(PROVISIONING_PROFILE_SPECIFIER = "#{profile_name}")) &&
      body.include?("DEVELOPMENT_TEAM[sdk=iphoneos*]\" = #{team_id}") &&
      body.include?(%("CODE_SIGN_IDENTITY[sdk=iphoneos*]" = "Apple Distribution"))
  end
end
