# Dk_Blockchain_Project
# solana config set --url https://api.devnet.solana.com(Devnet setuo)
# program id = 98n8KiwLYGyheLY7RsgN8zgECif19ukFAmafMAkE41eg
# program adress = DREzgPRuKYNrBNF6sGMv6QTYoEBgZkGVFLb7DRRZHfvo
# SPL cli istall for f_token = cargo install spl-token-cli

# Think of a PDA (Program Derived Address) like this: is a wallet address that only a program can control,and no human has the private key for it.
# solana-test-validator --reset (rreset test validator)
# solana config set --url localhost(loaclvalidator)

# rm -rf ~/.config/solana/test-ledger(reset legger when validator fails distrubs)

# anchor clean rm -rf target anchor build