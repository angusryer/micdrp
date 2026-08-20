# keychain.rb — a dedicated, unattended-safe signing keychain.
#
# Signing from the login keychain stops the build with a GUI dialog
# ("codesign wants to sign using key ... in your keychain"), because the
# imported key has no partition list authorising codesign to use it. A build
# that waits for a click cannot be kicked off remotely: it simply hangs.
#
# This builds a throwaway keychain instead, imports the distribution identity
# into it, and authorises codesign explicitly. Nothing here touches the login
# keychain, so it behaves the same on this Mac and on a fresh CI runner.

require "shellwords"

module SigningKeychain
  NAME = "micdrp-signing".freeze

  def self.path = File.expand_path("~/Library/Keychains/#{NAME}-db")

  SECRETS_FILE = File.join(__dir__, "signing", "signing.env").freeze
  P12_FILE     = File.join(__dir__, "signing", "micdrp-distribution.p12").freeze

  # Signing secrets are read from signing.env, never from the app's .env.
  # react-native-config compiles .env into ios/tmp.xcconfig, and env.xcconfig
  # is copied into the app bundle — a password put there ships in the IPA.
  def self.password
    return ENV["SIGNING_KEYCHAIN_PASSWORD"] if ENV["SIGNING_KEYCHAIN_PASSWORD"]
    unless File.exist?(SECRETS_FILE)
      raise "Missing #{SECRETS_FILE}. Run `git secret reveal` from the repo root."
    end
    line = File.readlines(SECRETS_FILE).find { |l| l.strip.start_with?("SIGNING_KEYCHAIN_PASSWORD=") }
    raise "SIGNING_KEYCHAIN_PASSWORD not set in #{SECRETS_FILE}" unless line
    line.split("=", 2).last.strip
  end

  # Recreate from scratch every run: a keychain left over from a previous
  # build may be locked, or hold a certificate that has since been revoked.
  def self.prepare(password:, p12_path:, p12_password: nil)
    p12_password ||= password
    destroy
    sh_quiet("security create-keychain -p #{password.shellescape} #{NAME.shellescape}")
    # -lut 21600: do not auto-lock for six hours. The default locks after five
    # minutes of idle, which lands mid-archive on a cold build.
    sh_quiet("security set-keychain-settings -lut 21600 #{path.shellescape}")
    sh_quiet("security unlock-keychain -p #{password.shellescape} #{path.shellescape}")
    import(p12_path, p12_password, password)
    add_to_search_list
    path
  end

  def self.import(p12_path, p12_password, keychain_password)
    raise "Distribution p12 not found at #{p12_path}" unless File.exist?(p12_path)

    # -T grants these tools access to the key; -A would grant it to everything.
    sh_quiet(
      "security import #{p12_path.shellescape} -k #{path.shellescape} " \
      "-P #{p12_password.shellescape} -f pkcs12 " \
      "-T /usr/bin/codesign -T /usr/bin/security -T /usr/bin/productbuild"
    )

    # The step that actually prevents the prompt. Granting -T at import time is
    # not enough on modern macOS: the key's partition list must name codesign,
    # and setting it requires the keychain password.
    sh_quiet(
      "security set-key-partition-list -S apple-tool:,apple:,codesign: " \
      "-s -k #{keychain_password.shellescape} #{path.shellescape}"
    )
  end

  # Prepend to the user search list, preserving whatever was already there so
  # the login keychain keeps working for everything else on this machine.
  def self.add_to_search_list
    existing = `security list-keychains -d user`.scan(/"(.*?)"/).flatten
    return if existing.include?(path)
    all = ([path] + existing).map(&:shellescape).join(" ")
    sh_quiet("security list-keychains -d user -s #{all}")
  end

  def self.destroy
    return unless File.exist?(path)
    existing = `security list-keychains -d user`.scan(/"(.*?)"/).flatten - [path]
    sh_quiet("security list-keychains -d user -s #{existing.map(&:shellescape).join(' ')}") if existing.any?
    sh_quiet("security delete-keychain #{path.shellescape}")
  end

  def self.identities
    `security find-identity -v -p codesigning #{path.shellescape}`
  end

  def self.sh_quiet(cmd)
    out = `#{cmd} 2>&1`
    raise "keychain step failed: #{cmd}\n#{out}" unless $?.success?
    out
  end
end
