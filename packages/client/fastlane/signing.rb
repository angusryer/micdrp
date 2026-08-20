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
end
